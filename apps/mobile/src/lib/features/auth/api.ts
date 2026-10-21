import { http } from '../../api/http';

export const authApi = {
  signup(input: { name: string; email: string; password: string }) {
    return http<unknown>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  login(input: { email: string; password: string }) {
    return http<unknown>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  refresh(refreshToken: string) {
    return http<unknown>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
  logout(refreshToken: string) {
    return http<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};
