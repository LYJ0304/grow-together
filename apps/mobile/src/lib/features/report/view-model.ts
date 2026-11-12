// Presentation boundary, not a server DTO. API issue 184 owns the wire contract and mapper.
export type ReportSuggestion = {
  title: string;
  description: string;
  reason: string;
};
export type WeeklyReportViewModel = {
  current: boolean;
  planned: number;
  eligible: number;
  completed: number;
  diaryDays: number;
  completionRate: number | null;
  daily: { date: string; label: string; completed: number }[];
  activities: { name: string; count: number }[];
  memories: {
    id: number;
    date: string;
    excerpt: string;
    activities: string[];
  }[];
  insight:
    | { state: 'notGenerated' | 'insufficient' | 'error' | 'unavailable' }
    | {
        state: 'ready';
        summary: string;
        observations: string[];
        suggestions: ReportSuggestion[];
      };
};
export type WeeklyReportResource =
  | { state: 'unavailable' | 'loading' | 'loginRequired' }
  | { state: 'error'; message: string }
  | { state: 'ready'; report: WeeklyReportViewModel };
