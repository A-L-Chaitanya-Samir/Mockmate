class AppError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


class ProviderError(AppError):
    def __init__(self, message='AI processing failed. Please retry.', retry_after=30):
        super().__init__(503, 'provider_unavailable', message)
        self.retry_after = min(300, max(1, retry_after))
