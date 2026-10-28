import { HttpAgent, type Message } from '@ag-ui/client';
import type { AuthSession } from './features/auth';

type ChatStatus =
  'idle' | 'connecting' | 'streaming' | 'complete' | 'error' | 'stopped';
type Snapshot = {
  messages: Message[];
  status: ChatStatus;
  notice: string;
  retryText: string;
};
const empty = (): Snapshot => ({
  messages: [],
  status: 'idle',
  notice: '',
  retryText: '',
});

export class ChatSession {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private threadId: string | null = null;
  private context: Message[] = [];
  private pendingUser: Message | null = null;
  private active: { controller: AbortController; agent?: HttpAgent } | null =
    null;

  constructor(
    private auth: Pick<AuthSession, 'request' | 'stream'>,
    private fetcher: typeof fetch,
    private id: () => string,
  ) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(update: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach((listener) => listener());
  }

  clear = () => {
    const active = this.active;
    this.active = null;
    active?.controller.abort();
    active?.agent?.abortRun();
    this.threadId = null;
    this.context = [];
    this.pendingUser = null;
    this.publish(empty());
  };

  stop = () => {
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.controller.abort();
    active.agent?.abortRun();
    this.publish({
      status: 'stopped',
      notice: '응답을 중단했어요. 받은 내용은 보존했어요.',
    });
  };

  send = async (value: string) => {
    const text = value.trim();
    if (this.active || !text) return;
    if (text.length > 4000 || this.context.length >= 39) {
      this.publish({
        notice:
          text.length > 4000
            ? '질문은 4,000자 이내로 입력해주세요.'
            : '대화가 길어졌어요. 새 상담을 시작해주세요.',
      });
      return;
    }
    this.pendingUser = { id: this.id(), role: 'user', content: text };
    this.publish({
      messages: [...this.snapshot.messages, this.pendingUser],
      retryText: text,
    });
    await this.run();
  };

  retry = async () => {
    if (!this.active && this.pendingUser && this.snapshot.retryText)
      await this.run();
  };

  private async run() {
    const user = this.pendingUser!;
    const active = {
      controller: new AbortController(),
      agent: undefined as HttpAgent | undefined,
    };
    this.active = active;
    this.publish({ status: 'connecting', notice: '' });
    const visible = this.snapshot.messages;
    const inputMessages = [...this.context, user];
    const current = () => this.active === active;
    let finished = false;
    let failed = false;
    // A bound covers a silent server even if it never sends HTTP headers or a terminal event.
    const timeout = setTimeout(() => {
      if (!current()) return;
      failed = true;
      this.active = null;
      active.controller.abort();
      active.agent?.abortRun();
      this.publish({
        status: 'error',
        notice: '응답 시간이 길어졌어요. 다시 시도해주세요.',
      });
    }, 130000);
    try {
      if (!this.threadId) {
        const thread = await this.auth.request<{ threadId: string }>(
          '/api/v1/chat-threads',
          { method: 'POST' },
        );
        if (!current()) return;
        this.threadId = thread.threadId;
      }
      const path = `/api/v1/chat-threads/${encodeURIComponent(this.threadId)}/runs`;
      const agent = new HttpAgent({
        agentId: 'counselor',
        url: path,
        threadId: this.threadId,
        initialMessages: inputMessages,
        fetch: (_url, init) => this.auth.stream(path, init, this.fetcher),
      });
      active.agent = agent;
      await agent.runAgent(
        { runId: this.id(), abortController: active.controller },
        {
          onMessagesChanged: ({ messages }) => {
            if (!current()) return;
            const replies = [...messages].slice(
              inputMessages.length,
            ) as Message[];
            this.publish({ messages: [...visible, ...replies] });
          },
          onTextMessageContentEvent: () => {
            if (current()) this.publish({ status: 'streaming' });
          },
          onRunErrorEvent: () => {
            if (!current()) return;
            failed = true;
            this.publish({
              status: 'error',
              notice: '응답을 완료하지 못했어요. 다시 시도해주세요.',
            });
          },
          onRunFinishedEvent: ({ outcome }) => {
            finished = outcome === 'success';
          },
        },
      );
      if (!current() || failed) return;
      if (!finished) throw new Error('Incomplete stream');
      this.context = agent.messages;
      this.pendingUser = null;
      this.publish({ status: 'complete', retryText: '', notice: '' });
    } catch {
      if (current() && !failed)
        this.publish({
          status: 'error',
          notice:
            '응답을 완료하지 못했어요. 연결을 확인하고 다시 시도해주세요.',
        });
    } finally {
      clearTimeout(timeout);
      if (current()) this.active = null;
    }
  }
}
