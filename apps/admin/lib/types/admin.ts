export type UserStatus = "active" | "suspended" | "invited";
export type FeatureId = "schedule" | "report" | "diary" | "chat";
export type RequestStatus = "success" | "failed";
export type ServiceStatus = "healthy" | "degraded" | "down";
export type DateRange = 7 | 14 | 30;
export type DemoView = "ready" | "loading" | "empty" | "error";
export type User = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  joinedAt: string;
  lastActive: string | null;
};
export type AiRequest = {
  id: string;
  feature: FeatureId;
  status: RequestStatus;
  at: string;
  latencyMs: number;
  tokens: number;
  cost: number;
  code?: string;
};
export type Service = {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  checkedAt: string;
  latencyMs: number;
  error: string | null;
};
export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: "user.status" | "session.revoke" | "settings.update" | "demo.start";
  target: string;
  result: "success" | "failed";
  description: string;
};
export type DemoSettings = {
  workspaceName: string;
  operatorName: string;
  operatorEmail: string;
  flags: Record<FeatureId, boolean>;
  dailyLimit: number;
  monthlyBudget: number;
};
export type UserQuery = {
  search: string;
  status: UserStatus | "all";
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
};
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
};
