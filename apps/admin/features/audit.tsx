"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Panel,
  FilterBar,
  DataTable,
  Pagination,
  StatusBadge,
  DetailDrawer,
  DemoBoundary,
  EmptyState,
  type Column,
} from "@/components/shared/primitives";
import { useDemo } from "@/lib/demo-context";
import { adminDemoRepository } from "@/lib/mock/repository";
import { useDemoQuery } from "@/lib/use-demo-query";
import { timestamp } from "@/lib/utils";
import type { AuditEvent } from "@/lib/types/admin";
export function AuditScreen() {
  const { audit } = useDemo();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const query = useDemoQuery(
    useCallback(
      () => adminDemoRepository.audit({ search, action, from, to }, audit),
      [search, action, from, to, audit],
    ),
  );
  const rows = query.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const currentPage = Math.min(page, pageCount);
  const columns: Column<AuditEvent>[] = [
    {
      key: "at",
      title: "Timestamp · KST",
      render: (r) => <span className="small-mono">{timestamp(r.at)}</span>,
    },
    { key: "actor", title: "Actor", render: (r) => r.actor },
    {
      key: "action",
      title: "Action",
      render: (r) => <span className="action-code">{r.action}</span>,
    },
    {
      key: "target",
      title: "Target",
      render: (r) => <span className="small-mono">{r.target}</span>,
    },
    {
      key: "result",
      title: "Result",
      render: (r) => <StatusBadge status={r.result} />,
    },
    {
      key: "detail",
      title: "Details",
      render: (r) => (
        <Button variant="ghost" onClick={() => setSelected(r)}>
          상세
        </Button>
      ),
    },
  ];
  function clear() {
    setSearch("");
    setAction("all");
    setFrom("");
    setTo("");
    setPage(1);
  }
  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="관리자 작업 흐름을 확인하세요. 모든 로그는 샘플 또는 로컬 시뮬레이션입니다."
      />
      <Panel
        title="작업 기록"
        description="최신순 · 새로고침 시 로컬 작업 기록 초기화"
        className="table-panel"
      >
        <FilterBar
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="작업자, 작업 유형 또는 대상 검색"
        >
          <label className="field">
            <span>작업 유형</span>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">모든 작업</option>
              <option value="user.status">계정 상태 변경</option>
              <option value="session.revoke">세션 철회</option>
              <option value="settings.update">설정 변경</option>
              <option value="demo.start">데모 시작</option>
            </select>
          </label>
          <label className="field">
            <span>시작일 · KST</span>
            <input
              type="date"
              aria-label="감사 로그 시작일"
              max={to || undefined}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="field">
            <span>종료일 · KST</span>
            <input
              type="date"
              aria-label="감사 로그 종료일"
              min={from || undefined}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </FilterBar>
        {from && to && from > to && (
          <p className="form-error" role="alert">
            종료일은 시작일 이후여야 합니다.
          </p>
        )}
        <DemoBoundary loading={query.loading} error={query.error}>
          {rows.length ? (
            <>
              <DataTable
                rows={rows.slice((currentPage - 1) * 8, currentPage * 8)}
                columns={columns}
                onSelect={setSelected}
                renderMobile={(r) => (
                  <>
                    <span className="audit-card-top">
                      <strong>{r.action}</strong>
                      <StatusBadge status={r.result} />
                    </span>
                    <span className="list-email">
                      {r.actor} → {r.target}
                    </span>
                    <time className="list-meta">{timestamp(r.at)} KST</time>
                  </>
                )}
              />
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                total={rows.length}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState
              title="조건에 맞는 작업 기록이 없어요"
              action={
                <Button variant="outline" onClick={clear}>
                  필터 초기화
                </Button>
              }
            />
          )}
        </DemoBoundary>
      </Panel>
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="감사 로그 상세"
        description="가상의 관리 작업 또는 이 브라우저의 로컬 데모 작업입니다."
      >
        {selected && (
          <>
            <dl className="detail-grid">
              <dt>로그 ID</dt>
              <dd>{selected.id}</dd>
              <dt>Timestamp</dt>
              <dd>{timestamp(selected.at)} KST</dd>
              <dt>Actor</dt>
              <dd>{selected.actor}</dd>
              <dt>Action</dt>
              <dd>{selected.action}</dd>
              <dt>Target</dt>
              <dd>{selected.target}</dd>
              <dt>Result</dt>
              <dd>
                <StatusBadge status={selected.result} />
              </dd>
            </dl>
            <div className="callout">{selected.description}</div>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
