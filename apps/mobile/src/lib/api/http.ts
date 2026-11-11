import { env } from '../../config/env';
import { ApiError, messages } from './errors';

export type HttpRequestInit = RequestInit & { timeoutMs?: number };

export async function http<T>(
  path: string,
  init: HttpRequestInit = {},
): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new ApiError(
      0,
      'API_NOT_CONFIGURED',
      'API 연결이 설정되지 않았어요. 미리보기를 이용해 주세요.',
    );
  }
  const { timeoutMs = 15000, ...fetchInit } = init;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const code = typeof error?.code === 'string' ? error.code : 'HTTP_ERROR';
      throw new ApiError(
        response.status,
        code,
        messages[code] ?? '요청을 처리하지 못했어요. 다시 시도해주세요.',
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}
