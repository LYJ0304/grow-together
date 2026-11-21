import {
  dayAt,
  demoAudit,
  demoRequests,
  demoServices,
  demoUsers,
  featureDefinitions,
  MOCK_NOW,
} from "./fixtures.ts";
import type {
  AiRequest,
  AuditEvent,
  DateRange,
  FeatureId,
  PageResult,
  RequestStatus,
  User,
  UserQuery,
} from "../types/admin.ts";
export const demoSnapshot = MOCK_NOW;
export const localDay = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export const inRange = (date: string, range: DateRange) =>
  Date.parse(date) >=
    Date.parse(`${localDay(MOCK_NOW)}T00:00:00+09:00`) -
      (range - 1) * 86400000 && Date.parse(date) <= Date.parse(MOCK_NOW);
export function queryUsers(
  query: UserQuery,
  source: User[] = demoUsers,
): PageResult<User> {
  const search = query.search.trim().toLocaleLowerCase();
  const filtered = source
    .filter(
      (user) =>
        (query.status === "all" || user.status === query.status) &&
        `${user.id} ${user.email} ${user.name}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .sort((a, b) =>
      query.sort === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.max(1, Math.min(query.page, pageCount));
  return {
    items: filtered.slice((page - 1) * query.pageSize, page * query.pageSize),
    total: filtered.length,
    page,
    pageCount,
  };
}
export function queryRequests(
  range: DateRange,
  feature: FeatureId | "all" = "all",
  status: RequestStatus | "all" = "all",
) {
  return demoRequests
    .filter(
      (row) =>
        inRange(row.at, range) &&
        (feature === "all" || row.feature === feature) &&
        (status === "all" || row.status === status),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function summarizeRequests(rows: AiRequest[]) {
  const success = rows.filter((row) => row.status === "success").length;
  return {
    total: rows.length,
    success,
    failed: rows.length - success,
    successRate: rows.length ? (success / rows.length) * 100 : 0,
    latency: rows.length
      ? rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length
      : 0,
    tokens: rows.reduce((sum, row) => sum + row.tokens, 0),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
  };
}
export function queryAudit(
  query: { search: string; action: string; from: string; to: string },
  source: AuditEvent[] = demoAudit,
) {
  const needle = query.search.trim().toLowerCase();
  return source
    .filter(
      (row) =>
        (query.action === "all" || row.action === query.action) &&
        `${row.id} ${row.actor} ${row.action} ${row.target}`
          .toLowerCase()
          .includes(needle) &&
        (!query.from || localDay(row.at) >= query.from) &&
        (!query.to || localDay(row.at) <= query.to),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function requestSeries(
  range: DateRange,
  rows: AiRequest[] = queryRequests(range),
) {
  return Array.from({ length: range }, (_, i) => {
    const day = localDay(dayAt(range - 1 - i));
    const daily = rows.filter((row) => localDay(row.at) === day);
    return {
      label: day.slice(5).replace("-", "."),
      requests: daily.length,
      success: daily.filter((r) => r.status === "success").length,
      failed: daily.filter((r) => r.status === "failed").length,
    };
  });
}
export const adminDemoRepository = {
  async overview(range: DateRange, users: User[] = demoUsers) {
    const requests = queryRequests(range);
    return {
      users: users.length,
      newUsers: users.filter((user) => inRange(user.joinedAt, 7)).length,
      activeUsers: users.filter(
        (user) => user.lastActive && inRange(user.lastActive, 7),
      ).length,
      ai: summarizeRequests(requests),
      signups: Array.from({ length: range }, (_, i) => {
        const day = localDay(dayAt(range - 1 - i));
        return {
          label: day.slice(5).replace("-", "."),
          signups: users.filter((user) => localDay(user.joinedAt) === day)
            .length,
        };
      }),
      usage: featureDefinitions.map((feature) => ({
        label: feature.short,
        value: requests.filter((row) => row.feature === feature.id).length,
      })),
      services: demoServices,
      errors: requests.filter((row) => row.status === "failed").slice(0, 4),
    };
  },
  async users(query: UserQuery, source: User[]) {
    return queryUsers(query, source);
  },
  async ai(
    range: DateRange,
    feature: FeatureId | "all",
    status: RequestStatus | "all",
  ) {
    const requests = queryRequests(range, feature, status);
    return {
      stats: summarizeRequests(requests),
      series: requestSeries(range, requests),
      usage: featureDefinitions.map((f) => ({
        label: f.short,
        value: requests.filter((r) => r.feature === f.id).length,
      })),
      errors: requests.filter((row) => row.status === "failed").slice(0, 6),
    };
  },
  async services() {
    return demoServices;
  },
  async audit(
    query: { search: string; action: string; from: string; to: string },
    source: AuditEvent[],
  ) {
    return queryAudit(query, source);
  },
};
