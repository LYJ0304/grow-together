export type ChildReaction = 'ENJOYED' | 'NEUTRAL' | 'DIFFICULT';

export type CreateTodoResponse = {
  message: string;
};

export type TodoRequest = {
  planName: string;
  content?: string | null;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number | null;
};

export type TodoResponse = {
  id: number;
  completed: boolean;
  childReaction?: ChildReaction | null;
  planName: string;
  content?: string | null;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number | null;
};

export type ScheduleCandidate = {
  planName: string;
  content?: string | null;
  scheduledTime: string;
  durationMinutes: number;
};
export type SchedulePreview = {
  date: string;
  candidates: ScheduleCandidate[];
  unscheduled: {
    planName: string;
    content?: string | null;
    durationMinutes: number;
  }[];
};
export type ScheduleRequest = {
  date: string;
  instructions?: string;
  availableWindows: { start: string; end: string }[];
  maxCandidates?: number;
};
