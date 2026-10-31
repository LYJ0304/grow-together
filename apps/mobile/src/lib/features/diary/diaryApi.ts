import { createClient } from '../../api/client';
import type { AuthSession } from '../auth';
import type { DiaryRequest, DiaryResponse } from './types';

export function createDiaryApi(session: Pick<AuthSession, 'request'>) {
  const client = createClient(session.request.bind(session));
  return {
    async createDiary(input: DiaryRequest): Promise<DiaryResponse> {
      return client.post<DiaryResponse>('/api/v1/diary', input);
    },
    async getDiary(id: number): Promise<DiaryResponse> {
      return client.get<DiaryResponse>(`/api/v1/diary/${id}`);
    },
    async updateDiary(id: number, input: DiaryRequest): Promise<DiaryResponse> {
      return client.put<DiaryResponse>(`/api/v1/diary/${id}`, input);
    },
    async deleteDiary(id: number): Promise<void> {
      return client.delete<void>(`/api/v1/diary/${id}`);
    },
  };
}
