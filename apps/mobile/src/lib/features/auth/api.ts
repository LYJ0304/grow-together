import { client } from '../../api/client';

export const authApi = {
  signup(input: { name: string; email: string; password: string }) {
    return client.post<unknown>('/api/v1/auth/signup', input);
  },
  login(input: { email: string; password: string }) {
    return client.post<unknown>('/api/v1/auth/login', input);
  },
  refresh(refreshToken: string) {
    return client.post<unknown>('/api/v1/auth/refresh', { refreshToken });
  },
  logout(refreshToken: string) {
    return client.post<void>('/api/v1/auth/logout', { refreshToken });
  },
};
