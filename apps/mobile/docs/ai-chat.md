# AI counseling chat

The existing Expo UI consumes AG-UI 1.0 through `@ag-ui/client` 1.0.3 and
`expo/fetch` (Expo 55). `expo-crypto` generates explicit message/run IDs on
Hermes. The Python producer uses `ag-ui-protocol` 1.0.0. `RUN_ERROR` is handled
explicitly: a resolved SDK promise or HTTP 200 does not mean success.

## Client choice

CopilotKit supports native React Native components and headless hooks. We use
`HttpAgent` directly for this text-only screen: it connects to the existing
Spring endpoint without introducing a CopilotKit runtime or replacing the UI.
Reconsider CopilotKit when frontend tools, shared agent state, or human approval
become concrete requirements. This is a scoped dependency choice, not a claim
that CopilotKit lacks React Native support.

The client uses the existing patched Zod 4 dependency for AG-UI validation via
targeted npm overrides; the SDK's default Zod 3 resolution has a known advisory.
The event/session tests exercise the resulting combination.

## Behavior and storage

- A thread UUID is created through the authenticated API; ownership is persisted.
- Message history and input drafts live only in the authenticated client session.
  Tab navigation preserves them; reload, logout, account changes, and ending preview
  clear them. Messages are not persisted on the API yet.
- Only completed turns are sent as context. Partial failed/cancelled replies stay
  visible, but do not become model context. Retry uses the pending user message
  with a new run ID, without another user bubble.
- One request runs at a time. At 20 completed turns, start a new conversation.
  Each input/output is limited to 4,000 characters. No tools or client system
  prompts are accepted. The worker has a 120s total budget, API 125s, client 130s.
- Token refresh retries only an HTTP 401 before the stream opens. Mid-stream
  failures require manual retry; SSE replay/resumption is not supported.
- Auth preview can browse the screen but cannot call the AI endpoint.

The worker is private: only the API knows `WORKER_TOKEN`; model credentials never
use `EXPO_PUBLIC_*`. See [worker setup](../../ai-worker/docs/development.md).

## Verification

```bash
npm run test:chat
npm run test:auth:stream
npm run test:auth
npm run typecheck
npm run lint
```

Serve an Expo web export on a chosen local port, then run:

```bash
CHAT_URL=http://127.0.0.1:8210 npm run test:chat:status
CHAT_URL=http://127.0.0.1:8210 npm run test:chat:ui
CHAT_URL=http://127.0.0.1:8210 npm run test:chat:composer
CHAT_URL=http://127.0.0.1:8210 npm run test:chat:keyboard
CHAT_URL=http://127.0.0.1:8210 npm run test:chat:draft
CHAT_URL=http://127.0.0.1:8210 CHAT_API_URL=http://127.0.0.1:18110 node tests/chat-api.mjs
```

`chat-api.mjs` uses test accounts against a locally running API + worker + fake
model and checks actual browser streaming, retry, cancellation and logout. Run
it only against an isolated development database. The fake model setup is in
the worker guide. Native bundles are useful compatibility checks but do not
replace physical Android/iOS streaming, cancellation, keyboard and backgrounding
checks. Record each platform's actual result; never infer native success from web.

References: [AG-UI HttpAgent](https://docs.ag-ui.com/sdk/js/client/http-agent),
[HTTP/SSE](https://docs.ag-ui.com/spec/1.0/basic/transports/http-sse),
[Expo 55 fetch](https://docs.expo.dev/versions/v55.0.0/sdk/expo/),
[CopilotKit React Native](https://docs.copilotkit.ai/reference/react-native/index).
