import { z } from 'zod';
import { client } from '../../api/client';
import { parseTokens } from './tokens';

const signupResponseSchema = z.object({ message: z.string() });
const logoutResponseSchema = z.undefined();

export const authApi = {
  async signup(input: { name: string; email: string; password: string }) {
    const response = await client.post('/api/v1/auth/signup', input);
    const result = signupResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error('회원가입 응답을 확인하지 못했어요.');
    }
    return result.data;
  },
  async login(input: { email: string; password: string }) {
    return parseTokens(await client.post('/api/v1/auth/login', input));
  },
  async refresh(refreshToken: string) {
    return parseTokens(
      await client.post('/api/v1/auth/refresh', { refreshToken }),
    );
  },
  async logout(refreshToken: string) {
    const response = await client.post('/api/v1/auth/logout', { refreshToken });
    if (!logoutResponseSchema.safeParse(response).success) {
      throw new Error('로그아웃 응답을 확인하지 못했어요.');
    }
  },
};
