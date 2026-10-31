import type { TodoResponse } from '../todo/types';

export type DiaryFileRequest = {
  imageUrl: string;
};

export type DiaryRequest = {
  content?: string | null;
  todoIds: number[];
  diaryFiles: DiaryFileRequest[];
};

export type DiaryFileResponse = {
  id: number;
  imageUrl: string;
};

export type DiaryResponse = {
  id: number;
  content?: string | null;
  todos: TodoResponse[];
  diaryFiles: DiaryFileResponse[];
};
