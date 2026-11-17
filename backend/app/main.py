import logging
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException
from app.api.v1.routes import router
from app.core.config import settings
from app.core.db import transaction
from app.core.errors import AppError

# Never log HTTP bodies, bearer tokens, resume content or provider responses.
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('pypdf').setLevel(logging.CRITICAL)
app = FastAPI(title='Mockmate API', version='2.0.0')


class BodyLimitMiddleware:
    """Bound uploads and JSON even when Content-Length is absent or dishonest."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        path = scope['path']
        if path.endswith('/vision-checks'):
            maximum = settings().vision_max_image_bytes + 16384
        else:
            maximum = ((settings().max_audio_bytes if path.endswith('/transcriptions') else settings().max_pdf_bytes) + 1024*1024
                if path.endswith('/transcriptions') or path.endswith('/resumes') else 65536)
        consumed = 0
        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            if message['type'] == 'http.request':
                consumed += len(message.get('body', b''))
                if consumed > maximum:
                    scope['mockmate_body_limit'] = True
                    raise HTTPException(413, 'Request exceeds the supported upload or JSON size limit.')
            return message
        await self.app(scope, bounded_receive, send)


@app.middleware('http')
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    try:
        length = request.headers.get('content-length')
        limit = settings().max_audio_bytes if request.url.path.endswith('/transcriptions') else settings().max_pdf_bytes
        if length and int(length) > limit + 1024 * 1024:
            raise AppError(413, 'request_size', 'Request is too large. PDFs are limited to 5 MB and answer audio to 8 MB.')
        response = await call_next(request)
    except AppError as exc:
        response = error_response(request, exc.status, exc.code, exc.message, getattr(exc, 'quota', None))
    except Exception as exc:
        response = await unexpected_error(request, exc)
    if request.scope.get('mockmate_body_limit'):
        response = error_response(request, 413, 'request_size', 'Request exceeds the supported upload or JSON size limit.')
    response.headers['X-Request-ID'] = request.state.request_id
    response.headers['Cache-Control'] = 'no-store'
    return response


def error_response(request, status, code, message, quota=None):
    return JSONResponse(status_code=status, content=jsonable_encoder({'error': {'code': code, 'message': message, 'quota': quota,
        'request_id': getattr(request.state, 'request_id', str(uuid4()))}}))


@app.exception_handler(AppError)
async def app_error(request, exc):
    return error_response(request, exc.status, exc.code, exc.message, getattr(exc, 'quota', None))


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return error_response(request, 422, 'validation_error', 'Invalid request. Check the required fields and supported options.')


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    if exc.status_code == 413:
        return error_response(request, 413, 'request_size', 'Request exceeds the supported upload or JSON size limit.')
    return error_response(request, exc.status_code, 'http_error', 'Request could not be completed.')


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logging.getLogger('mockmate').error('request_failed request_id=%s type=%s', getattr(request.state, 'request_id', ''), type(exc).__name__)
    return error_response(request, 503, 'temporarily_unavailable', 'Service temporarily unavailable. Please retry.')


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/ready')
def ready():
    cfg = settings()
    if cfg.missing_configuration():
        raise AppError(503, 'setup_required', 'Provider configuration is incomplete.')
    with transaction() as conn:
        conn.execute('SELECT 1 FROM jobs LIMIT 1')
        worker = conn.execute("SELECT 1 FROM worker_heartbeats WHERE seen_at>now()-interval '180 seconds' LIMIT 1").fetchone()
        if not worker:
            raise AppError(503, 'worker_unavailable', 'No recent worker heartbeat.')
    return {'status': 'ready'}


app.include_router(router)
app.add_middleware(CORSMiddleware, allow_origins=settings().cors_origins,
    allow_methods=['GET','POST','PUT','DELETE'], allow_headers=['Authorization','Content-Type','Idempotency-Key'], expose_headers=['X-Request-ID'])
app.add_middleware(BodyLimitMiddleware)
