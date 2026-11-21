import type {
  AiRequest,
  AuditEvent,
  DemoSettings,
  FeatureId,
  Service,
  User,
} from "../types/admin.ts";

export const MOCK_NOW = "2026-11-21T09:40:00+09:00";
export const featureDefinitions: {
  id: FeatureId;
  name: string;
  short: string;
  implementation: "available" | "planned";
  note: string;
}[] = [
  {
    id: "schedule",
    name: "Schedule Generation",
    short: "일정 생성",
    implementation: "available",
    note: "API / Worker 구현 경로 있음 · 이 콘솔과 연결되지 않음",
  },
  {
    id: "report",
    name: "Weekly Report",
    short: "주간 리포트",
    implementation: "available",
    note: "API / Worker 구현 경로 있음 · 이 콘솔과 연결되지 않음",
  },
  {
    id: "diary",
    name: "Diary AI",
    short: "일기 정리",
    implementation: "planned",
    note: "앱의 로컬 문장 정리만 구현 · 서버 AI는 Planned",
  },
  {
    id: "chat",
    name: "Chat AI",
    short: "육아 채팅",
    implementation: "planned",
    note: "앱의 메시지 UI만 구현 · 서버 AI는 Planned",
  },
];
export const dayAt = (daysAgo: number, hour = 9) =>
  new Date(
    Date.parse(MOCK_NOW) - daysAgo * 86_400_000 + (hour - 9) * 3_600_000,
  ).toISOString();
const names = [
  "김민서",
  "이서준",
  "박지우",
  "최하윤",
  "정도윤",
  "강서연",
  "조시우",
  "윤지안",
  "장하준",
  "임서아",
  "한지호",
  "오수빈",
  "서예준",
  "신다은",
  "권지유",
  "황지훈",
];
export const demoUsers: User[] = Array.from({ length: 128 }, (_, i) => ({
  id: `usr_${String(i + 1).padStart(4, "0")}`,
  name: names[i % names.length],
  email: `parent${String(i + 1).padStart(3, "0")}@example.test`,
  status: i % 11 === 0 ? "suspended" : i % 7 === 0 ? "invited" : "active",
  joinedAt: dayAt(i % 30, (i % 12) + 1),
  lastActive: i % 7 === 0 ? null : dayAt(i % 14, (i % 12) + 1),
}));
export const demoRequests: AiRequest[] = Array.from({ length: 480 }, (_, i) => {
  const feature =
    featureDefinitions[i % 10 < 5 ? 0 : i % 10 < 8 ? 1 : i % 10 === 8 ? 2 : 3]
      .id;
  const failed = i % 17 === 0;
  const tokens = 2200 + ((i * 137) % 10_000);
  return {
    id: `req_${String(i + 1).padStart(5, "0")}`,
    feature,
    status: failed ? "failed" : "success",
    at: dayAt(i % 30, (i % 9) + 1),
    latencyMs: failed ? 8000 : 800 + ((i * 173) % 4200),
    tokens: failed ? 0 : tokens,
    cost: failed ? 0 : Number((tokens * 0.000003).toFixed(4)),
    code: failed ? (i % 2 ? "MODEL_TIMEOUT" : "RATE_LIMIT") : undefined,
  };
});
export const demoServices: Service[] = [
  {
    id: "api",
    name: "Spring Boot API",
    description: "Application API",
    status: "healthy",
    checkedAt: MOCK_NOW,
    latencyMs: 84,
    error: null,
  },
  {
    id: "worker",
    name: "FastAPI Worker",
    description: "AI orchestration",
    status: "degraded",
    checkedAt: MOCK_NOW,
    latencyMs: 1240,
    error: "DEMO_MODEL_TIMEOUT · 샘플 응답 지연",
  },
  {
    id: "database",
    name: "PostgreSQL",
    description: "Primary database",
    status: "healthy",
    checkedAt: MOCK_NOW,
    latencyMs: 12,
    error: null,
  },
  {
    id: "storage",
    name: "Object Storage",
    description: "Private media storage",
    status: "healthy",
    checkedAt: MOCK_NOW,
    latencyMs: 106,
    error: null,
  },
];
export const demoAudit: AuditEvent[] = Array.from({ length: 24 }, (_, i) => ({
  id: `evt_${String(i + 1).padStart(4, "0")}`,
  at: dayAt(i % 12, (i % 8) + 1),
  actor: i % 3 ? "Demo operator" : "Demo reviewer",
  action: (
    ["settings.update", "user.status", "session.revoke", "demo.start"] as const
  )[i % 4],
  target:
    i % 4 === 0 ? "workspace/demo" : `usr_${String(i + 1).padStart(4, "0")}`,
  result: i % 9 === 0 ? "failed" : "success",
  description:
    "가상 관리자 동작입니다. 실제 서비스나 계정은 변경되지 않았습니다.",
}));
export const defaultSettings: DemoSettings = {
  workspaceName: "Grow Together",
  operatorName: "Demo operator",
  operatorEmail: "operator@example.test",
  flags: { schedule: true, report: true, diary: false, chat: false },
  dailyLimit: 200,
  monthlyBudget: 30,
};
