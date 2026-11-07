class LLMError(Exception):
    pass


class LLMTimeoutError(LLMError):
    pass
