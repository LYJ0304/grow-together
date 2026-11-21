import assert from "node:assert/strict";
import { test } from "node:test";
import { queryUsers } from "../lib/mock/repository.ts";
import { demoUsers } from "../lib/mock/fixtures.ts";
const base = {
  search: "",
  status: "all",
  sort: "newest",
  page: 1,
  pageSize: 8,
};
test("users search, status, sorting and pagination operate on the same source without mutating it", () => {
  const before = JSON.stringify(demoUsers);
  const search = queryUsers({ ...base, search: "USR_0001" });
  assert.equal(search.total, 1);
  assert.equal(search.items[0].id, "usr_0001");
  const email = queryUsers({ ...base, search: "parent002@" });
  assert.equal(email.items[0].email, "parent002@example.test");
  const active = queryUsers({
    ...base,
    status: "active",
    sort: "oldest",
    page: 2,
  });
  assert(active.items.every((x) => x.status === "active"));
  assert.equal(active.items.length, 8);
  assert(active.items[0].joinedAt <= active.items[7].joinedAt);
  assert.equal(queryUsers({ ...base, search: "missing" }).total, 0);
  assert.equal(queryUsers({ ...base, page: 999 }).page, 16);
  assert.equal(JSON.stringify(demoUsers), before);
});

import {
  inRange,
  queryAudit,
  queryRequests,
  requestSeries,
  summarizeRequests,
} from "../lib/mock/repository.ts";
test("Korean calendar boundaries and aggregated request totals remain consistent", () => {
  assert.equal(inRange("2026-11-15T00:05:00+09:00", 7), true);
  assert.equal(inRange("2026-11-14T23:59:00+09:00", 7), false);
  assert.equal(inRange("2026-11-22T00:00:00+09:00", 7), false);
  const row = {
    id: "test",
    at: new Date("2026-11-21T00:05:00+09:00").toISOString(),
    actor: "Demo",
    action: "demo.start",
    target: "Demo",
    result: "success",
    description: "Sample",
  };
  assert.equal(
    queryAudit(
      { search: "", action: "all", from: "2026-11-21", to: "2026-11-21" },
      [row],
    ).length,
    1,
  );
  assert.equal(
    requestSeries(7).reduce((sum, day) => sum + day.requests, 0),
    queryRequests(7).length,
  );
  const stats = summarizeRequests(queryRequests(7));
  assert.equal(stats.success + stats.failed, stats.total);
  assert.equal(summarizeRequests([]).successRate, 0);
});

test("request history presents the newest sample events first", () => {
  const rows = queryRequests(30);
  assert(
    rows.every(
      (row, i) => i === 0 || Date.parse(rows[i - 1].at) >= Date.parse(row.at),
    ),
  );
});
