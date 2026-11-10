import logging
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
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


@app.middleware('http')
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    try:
        length = request.headers.get('content-length')
        if length and int(length) > settings().max_pdf_bytes + 1024 * 1024:
            raise AppError(413, 'request_size', 'Request is too large. PDFs are limited to 5 MB.')
        response = await call_next(request)
    except AppError as exc:
        response = error_response(request, exc.status, exc.code, exc.message)
    except Exception as exc:
        response = await unexpected_error(request, exc)
    response.headers['X-Request-ID'] = request.state.request_id
    response.headers['Cache-Control'] = 'no-store'
    return response


def error_response(request, status, code, message):
    return JSONResponse(status_code=status, content={'error': {'code': code, 'message': message,
        'request_id': getattr(request.state, 'request_id', str(uuid4()))}})


@app.exception_handler(AppError)
async def app_error(request, exc):
    return error_response(request, exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return error_response(request, 422, 'validation_error', 'Invalid request. Check the required fields and supported options.')


@app.exception_handler(HTTPException)
async def http_error(request, exc):
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
