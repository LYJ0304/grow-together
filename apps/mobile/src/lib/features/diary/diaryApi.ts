import { toByteArray } from 'base64-js';
import { createClient } from '../../api/client';
import type { AuthSession } from '../auth';
import type {
  DiaryCreateRequest,
  DiaryRequest,
  DiaryResponse,
  DiarySummary,
} from './types';

export function createDiaryApi(session: Pick<AuthSession, 'request'>) {
  const client = createClient(session.request.bind(session));
  return {
    async uploadPhoto(uri: string): Promise<string> {
      const base64 = uri.slice(uri.indexOf(',') + 1);
      const bytes = toByteArray(base64);
      const contentType = 'image/jpeg';
      const { fileId, uploadUrl } = await client.post<{
        fileId: string;
        uploadUrl: string;
      }>('/api/files/presigned-url', {
        filename: 'diary.jpg',
        contentType,
        fileSize: bytes.byteLength,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: bytes as Uint8Array<ArrayBuffer>,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('upload failed');
      } catch {
        throw new Error('사진을 업로드하지 못했어요. 다시 시도해주세요.');
      } finally {
        clearTimeout(timeout);
      }
      await client.post(`/api/files/${fileId}/complete`, {});
      return fileId;
    },
    async createDiary(input: DiaryCreateRequest): Promise<DiaryResponse> {
      return client.post<DiaryResponse>('/api/v1/diary', input);
    },
    async getMonth(month: string): Promise<DiarySummary[]> {
      return client.get<DiarySummary[]>(
        `/api/v1/diary?month=${encodeURIComponent(month)}`,
      );
    },
    async getByDate(date: string): Promise<DiaryResponse> {
      return client.get<DiaryResponse>(
        `/api/v1/diary/by-date?date=${encodeURIComponent(date)}`,
      );
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
