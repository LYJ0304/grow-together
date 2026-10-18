import { env } from '@/config/env';

export type TokenStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
};
type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};
type SessionStatus =
  | 'restoring'
  | 'restoreError'
  | 'storageError'
  | 'signedOut'
  | 'authenticated'
  | 'preview';
type Session = { status: SessionStatus; notice: string };

function parseTokens(value: unknown): Tokens {
  const tokens = value as Partial<Tokens> | null;
  if (
    !tokens ||
    typeof tokens.accessToken !== 'string' ||
    !tokens.accessToken ||
    typeof tokens.refreshToken !== 'string' ||
    !tokens.refreshToken ||
    tokens.tokenType !== 'Bearer' ||
    typeof tokens.expiresIn !== 'number' ||
    !Number.isInteger(tokens.expiresIn) ||
    tokens.expiresIn <= 0
  ) {
    throw new Error('로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요.');
  }
  return tokens as Tokens;
}

// The epoch also rejects responses from requests started before logout/account changes.
export class ApiClient {
  private tokens: Tokens | null = null;
  private epoch = 0;
  private session: Session = { status: 'restoring', notice: '' };
  private listeners = new Set<() => void>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  private refreshTask: { epoch: number; promise: Promise<void> } | null = null;
  private restoreTask: Promise<void> | null = null;

  constructor(
    private storage: TokenStorage,
    private clearUserData: () => void,
  ) {}

  getSnapshot = () => this.session;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(status: SessionStatus, notice = '') {
    this.session = { status, notice };
    this.listeners.forEach((listener) => listener());
  }

  private checkEpoch(epoch: number) {
    if (epoch !== this.epoch) throw new Error('로그인 상태가 변경되었어요.');
  }

  private persist<T>(operation: () => Promise<T>) {
    const next = this.storageQueue.catch(() => {}).then(operation);
    this.storageQueue = next;
    return next;
  }

  private async clearSession(notice = '') {
    const epoch = ++this.epoch;
    this.tokens = null;
    this.clearUserData();
    // Queue deletion before exposing the signed-out screen/new login.
    const cleared = this.persist(() => this.storage.clear());
    this.publish('signedOut', notice);
    try {
      await cleared;
    } catch {
      if (epoch === this.epoch)
        this.publish(
          'storageError',
          '기기의 로그인 정보를 삭제하지 못했어요. 다시 로그아웃해 주세요.',
        );
      throw new Error('기기의 로그인 정보를 삭제하지 못했어요.');
    }
  }

  private async saveTokens(value: unknown, epoch: number) {
    const tokens = parseTokens(value);
    try {
      this.checkEpoch(epoch);
      await this.persist(async () => {
        this.checkEpoch(epoch);
        // One record replaces the access/refresh pair together.
        await this.storage.write(JSON.stringify(tokens));
      });
      this.checkEpoch(epoch);
    } catch (error) {
      // Revoke newly issued credentials even if logout won the response race.
      void send('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }).catch(() => {});
      if (epoch === this.epoch) {
        await this.clearSession(
          '로그인 정보를 저장하지 못했어요. 다시 로그인해 주세요.',
        );
      }
      throw error;
    }
    this.tokens = tokens;
    this.publish('authenticated');
  }

  restore = (): Promise<void> => {
    if (this.restoreTask) return this.restoreTask;
    const epoch = this.epoch;
    this.publish('restoring');
    const task = (async () => {
      try {
        if (!this.tokens) {
          const raw = await this.persist(() => this.storage.read());
          this.checkEpoch(epoch);
          if (raw === null) {
            this.publish('signedOut');
            return;
          }
          try {
            this.tokens = parseTokens(JSON.parse(raw));
          } catch {
            await this.clearSession(
              '저장된 로그인 정보가 올바르지 않아요. 다시 로그인해 주세요.',
            );
            return;
          }
        }
        await this.refresh();
      } catch (error) {
        if (epoch === this.epoch) {
          this.publish(
            'restoreError',
            error instanceof Error
              ? error.message
              : '로그인을 복원하지 못했어요.',
          );
        }
      }
    })();
    this.restoreTask = task;
    void task.finally(() => {
      if (this.restoreTask === task) this.restoreTask = null;
    });
    return task;
  };

  signup(input: { name: string; email: string; password: string }) {
    return send('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: { email: string; password: string }) {
    const epoch = ++this.epoch;
    this.tokens = null;
    this.clearUserData();
    this.publish('signedOut');
    await this.persist(() => this.storage.clear());
    this.checkEpoch(epoch);
    const value = await send('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await this.saveTokens(value, epoch);
  }

  private refresh(): Promise<void> {
    const epoch = this.epoch;
    if (this.refreshTask?.epoch === epoch) return this.refreshTask.promise;
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken)
      return Promise.reject(
        new ApiError(401, 'UNAUTHORIZED', messages.UNAUTHORIZED),
      );
    const promise = (async () => {
      try {
        const value = await send('/api/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        await this.saveTokens(value, epoch);
      } catch (error) {
        if (
          epoch === this.epoch &&
          (!(error instanceof ApiError) || error.status === 401)
        )
          await this.clearSession(messages.INVALID_REFRESH_TOKEN);
        throw error;
      }
    })();
    const task = { epoch, promise };
    this.refreshTask = task;
    void promise
      .finally(() => {
        if (this.refreshTask === task) this.refreshTask = null;
      })
      .catch(() => {});
    return promise;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/api/') || path.startsWith('/api/v1/auth/'))
      throw new Error('인증 요청은 전용 메서드를 사용해 주세요.');
    const epoch = this.epoch;
    const accessToken = this.tokens?.accessToken;
    if (this.session.status !== 'authenticated' || !accessToken)
      throw new ApiError(401, 'UNAUTHORIZED', messages.UNAUTHORIZED);
    const invoke = (token: string) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return send<T>(path, { ...init, headers });
    };
    try {
      const result = await invoke(accessToken);
      this.checkEpoch(epoch);
      return result;
    } catch (error) {
      this.checkEpoch(epoch);
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    // A late 401 may refer to the old access token, after another request refreshed it.
    if (this.tokens?.accessToken === accessToken) await this.refresh();
    this.checkEpoch(epoch);
    try {
      const result = await invoke(this.tokens!.accessToken);
      this.checkEpoch(epoch);
      return result;
    } catch (error) {
      this.checkEpoch(epoch);
      if (error instanceof ApiError && error.status === 401)
        await this.clearSession(messages.UNAUTHORIZED);
      throw error;
    }
  }

  async logout() {
    const refreshToken = this.tokens?.refreshToken;
    // Clear immediately; even a consumed token can revoke its session on this API.
    const clear = this.clearSession();
    const epoch = this.epoch;
    const revoke = refreshToken
      ? send('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        })
      : Promise.resolve();
    const [local, remote] = await Promise.allSettled([clear, revoke]);
    if (epoch !== this.epoch) return;
    if (local.status === 'rejected') return;
    if (remote.status === 'rejected')
      this.publish(
        'signedOut',
        '기기에서 로그아웃했어요. 서버 연결 실패로 서버 세션은 만료 전까지 남아 있을 수 있어요.',
      );
  }

  async preview() {
    const authBypassSetting = process.env.EXPO_PUBLIC_ENABLE_AUTH_BYPASS;
    if (authBypassSetting !== undefined && authBypassSetting !== 'true') return;
    const cleared = this.clearSession();
    const epoch = this.epoch;
    await cleared;
    this.checkEpoch(epoch);
    this.publish('preview');
  }
}

export type HealthResponse = { status: string; service: string };
export const getHealth = () => send<HealthResponse>('/api/health');
