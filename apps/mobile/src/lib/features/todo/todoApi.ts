import { createClient } from '../../api/client';
import type { AuthSession } from '../auth';
import type { CreateTodoResponse, TodoRequest, TodoResponse } from './types';

export function createTodoApi(session: Pick<AuthSession, 'request'>) {
  const client = createClient(session.request.bind(session));
  return {
    async createTodo(input: TodoRequest): Promise<CreateTodoResponse> {
      return client.post<CreateTodoResponse>('/api/v1/todos', input);
    },
    async getTodos(date: string): Promise<TodoResponse[]> {
      return client.get<TodoResponse[]>(
        `/api/v1/todos?date=${encodeURIComponent(date)}`,
      );
    },
    async getTodo(id: number): Promise<TodoResponse> {
      return client.get<TodoResponse>(`/api/v1/todos/${id}`);
    },
    async updateTodo(id: number, input: TodoRequest): Promise<TodoResponse> {
      return client.put<TodoResponse>(`/api/v1/todos/${id}`, input);
    },
    async deleteTodo(id: number): Promise<void> {
      return client.delete<void>(`/api/v1/todos/${id}`);
    },
  };
}
