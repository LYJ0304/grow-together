import { http } from './http';

export type HealthResponse = { status: string; service: string };
export const getHealth = () => client.get<HealthResponse>('/api/health');

function mergeHeaders(input?: HeadersInit) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Custom-Headers': 'my-custom-value',
  });
  new Headers(input).forEach((value, name) => headers.set(name, value));
  return headers;
}

export function createClient(request: typeof http = http) {
  return {
    get<T = unknown>(endpoint: string, options?: RequestInit) {
      return request<T>(endpoint, {
        method: 'GET',
        ...options,
        headers: mergeHeaders(options?.headers),
      });
    },
    post<T = unknown>(endpoint: string, body: unknown, options?: RequestInit) {
      return request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        ...options,
        headers: mergeHeaders(options?.headers),
      });
    },
    put<T = unknown>(endpoint: string, body: unknown, options?: RequestInit) {
      return request<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
        ...options,
        headers: mergeHeaders(options?.headers),
      });
    },
    patch<T = unknown>(endpoint: string, body: unknown, options?: RequestInit) {
      return request<T>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body),
        ...options,
        headers: mergeHeaders(options?.headers),
      });
    },
    delete<T = unknown>(endpoint: string, options?: RequestInit) {
      return request<T>(endpoint, {
        method: 'DELETE',
        ...options,
        headers: mergeHeaders(options?.headers),
      });
    },
  };
}

export const client = createClient();
