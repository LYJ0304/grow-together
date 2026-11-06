import { createClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { ChildProfile } from '../../child-profile';
import type { AuthSession } from '../auth';

export function createChildApi(session: Pick<AuthSession, 'request'>) {
  const client = createClient(session.request.bind(session));
  const path = '/api/v1/children/me';
  return {
    async getProfile(): Promise<ChildProfile | null> {
      try {
        return await client.get<ChildProfile>(path);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    createProfile(input: ChildProfile) {
      return client.post<ChildProfile>(path, input);
    },
    saveProfile(input: ChildProfile) {
      return client.put<ChildProfile>(path, input);
    },
  };
}
