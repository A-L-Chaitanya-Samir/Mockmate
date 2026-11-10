from urllib.parse import quote
import httpx
from app.core.config import settings, configured
from app.core.errors import AppError


class Storage:
    def request(self, method, path, **kwargs):
        cfg = settings()
        if not configured(cfg.supabase_secret_key):
            raise AppError(503, 'setup_required', 'Private storage configuration is required.')
        try:
            headers = {'apikey': cfg.supabase_secret_key}
            if not cfg.supabase_secret_key.startswith('sb_secret_'):
                headers['Authorization'] = f'Bearer {cfg.supabase_secret_key}'
            response = httpx.request(method, f'{cfg.supabase_url}/storage/v1/{path}',
                headers={**headers, **kwargs.pop('headers', {})},
                timeout=30, **kwargs)
            response.raise_for_status()
            return response
        except httpx.HTTPError:
            raise AppError(503, 'storage_unavailable', 'Private file operation failed. Please retry.') from None

    def upload(self, path, data):
        self.request('POST', f'object/resumes/{quote(path)}', content=data, headers={'Content-Type': 'application/pdf', 'x-upsert': 'true'})

    def download(self, path):
        return self.request('GET', f'object/resumes/{quote(path)}').content

    def delete(self, path):
        self.request('DELETE', 'object/resumes', json={'prefixes': [path]})

    def signed_url(self, path):
        data = self.request('POST', f'object/sign/resumes/{quote(path)}', json={'expiresIn': 60}).json()
        return f'{settings().supabase_url}/storage/v1{data["signedURL"]}'
