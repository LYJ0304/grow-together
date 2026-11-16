import { createClient } from '../../api/client';
import type { AuthSession } from '../auth';
import type { UserProfile } from './types';
export function createUserApi(session: Pick<AuthSession, 'request'>) {
  const client = createClient(session.request.bind(session));
  return {
    getProfile: () => client.get<UserProfile>('/api/v1/users/me'),
    updateName: (name: string) =>
      client.patch<UserProfile>('/api/v1/users/me', { name }),
  };
}
export const normalizeProfileName = (name: string) =>
  name.replace(/^[\s\u0085]+|[\s\u0085]+$/gu, '');
