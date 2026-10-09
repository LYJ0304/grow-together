# Growtogegher development rules

1. Prefer readable, maintainable code over cleverness.
2. Do not add abstractions or infrastructure before a concrete requirement needs them.
3. Keep mobile, API, and AI worker responsibilities independent.
4. Keep the AI worker provider- and feature-neutral; it is not a RAG-only component.
5. Do not prebuild unrequested features, directories, or placeholder classes.
6. Keep secrets out of source control; document required environment variables in `.env.example`.
7. Add focused tests for non-trivial behavior.
8. Prefer official documentation and stable releases.
9. Minimize service-to-service coupling; use `contracts/openapi.yaml` for API contracts.
10. Preserve module boundaries when extending the system.
