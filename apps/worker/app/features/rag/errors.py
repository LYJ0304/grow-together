class RagError(Exception):
    """Messages are fixed and safe to expose; never wrap raw provider/DB text."""


class RagConfigurationError(RagError):
    pass


class RagStorageError(RagError):
    pass


class RagCollectionError(RagError):
    pass


class RagConflictError(RagError):
    pass


class RagEmbeddingError(RagError):
    pass


class RagTimeoutError(RagError):
    pass


class RagGenerationError(RagError):
    pass
