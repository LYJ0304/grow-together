export type CreateTodoResponse = {
  message: string;
};

export type TodoRequest = {
  planName: string;
  content?: string | null;
  scheduledDate: string;
  scheduledTime: string;
};

export type TodoResponse = {
  id: number;
  planName: string;
  content?: string | null;
  scheduledDate: string;
  scheduledTime: string;
};
