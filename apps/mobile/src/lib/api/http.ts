import { env } from '@/config/env';
import { ApiError, messages } from './errors';


export async function http<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort, 15000);  
    try {
        const headers = new Headers(init.headers);
        headers.set('Accepet', 'application/json');
        if (init.body) headers.set('Content-Type', 'application/json');
        const response = await fetch(`${env.apiBaseUrl}${path}`, {
            ...init,
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
    }
}