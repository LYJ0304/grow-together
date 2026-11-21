"use client";
import { useCallback, useState } from "react";
import { MoreHorizontal, ShieldOff, KeyRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  FilterBar,
  DataTable,
  Pagination,
  StatusBadge,
  DemoBoundary,
  EmptyState,
  DetailDrawer,
  ConfirmDialog,
  type Column,
} from "@/components/shared/primitives";
import { useDemo } from "@/lib/demo-context";
import { useDemoQuery } from "@/lib/use-demo-query";
import { adminDemoRepository } from "@/lib/mock/repository";
import type { User, UserStatus } from "@/lib/types/admin";
import { timestamp } from "@/lib/utils";
export function UsersScreen() {
  const { users, simulateStatus, simulateRevoke } = useDemo();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"status" | "revoke" | null>(null);
  const current = users.find((u) => u.id === selected);
  const query = useDemoQuery(
    useCallback(
      () =>
        adminDemoRepository.users(
          { search, status, sort, page, pageSize: 8 },
          users,
        ),
      [search, status, sort, page, users],
    ),
  );
  const d = query.data;
  const columns: Column<User>[] = [
    {
      key: "name",
      title: "User",
      render: (u) => (
        <span className="user-name">
          <span className="user-avatar">{u.name.slice(0, 1)}</span>
          <span>
            <strong>{u.name}</strong>
            <small>{u.id}</small>
          </span>
        </span>
      ),
    },
    { key: "email", title: "Email", render: (u) => u.email },
    {
      key: "status",
      title: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "joined",
      title: "Joined at",
      sort: () => setSort((s) => (s === "newest" ? "oldest" : "newest")),
      direction: sort === "newest" ? "descending" : "ascending",
      render: (u) => timestamp(u.joinedAt),
    },
    {
      key: "active",
      title: "Last active",
      render: (u) =>
        u.lastActive ? timestamp(u.lastActive) : "아직 활동 없음",
    },
    {
      key: "actions",
      title: "Actions",
      render: (u) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${u.name} 상세 보기`}
          onClick={() => setSelected(u.id)}
        >
          <MoreHorizontal size={17} />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Users"
        description="계정 현황을 확인하고 관리 흐름을 시뮬레이션하세요."
      />
      <div className="panel table-panel">
        <FilterBar
          search={search}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="이름, 이메일 또는 사용자 ID 검색"
        >
          <label className="field">
            <span>계정 상태</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setPage(1);
              }}
            >
              <option value="all">모든 상태</option>
              <option value="active">활성</option>
              <option value="suspended">정지</option>
              <option value="invited">초대됨</option>
            </select>
          </label>
          <label className="field">
            <span>가입일 정렬</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
            >
              <option value="newest">최신 가입순</option>
              <option value="oldest">오래된 가입순</option>
            </select>
          </label>
        </FilterBar>
        <DemoBoundary loading={query.loading} error={query.error}>
          {d &&
            (d.total ? (
              <>
                <DataTable
                  rows={d.items}
                  columns={columns}
                  onSelect={(u) => setSelected(u.id)}
                  renderMobile={(u) => (
                    <>
                      <span className="mobile-user-heading">
                        <span className="user-avatar">
                          {u.name.slice(0, 1)}
                        </span>
                        <strong>{u.name}</strong>
                        <StatusBadge status={u.status} />
                      </span>
                      <span className="list-email">{u.email}</span>
                      <span className="list-meta">
                        {u.id} · 가입 {timestamp(u.joinedAt)}
                      </span>
                    </>
                  )}
                />
                <Pagination
                  page={d.page}
                  pageCount={d.pageCount}
                  total={d.total}
                  onChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                    }}
                  >
                    필터 초기화
                  </Button>
                }
              />
            ))}
        </DemoBoundary>
      </div>
      <p className="section-footnote">
        <UserRound size={14} />
        샘플 계정만 표시합니다. 아이 정보, 일기, 상담 내용은 포함하지 않습니다.
      </p>
      <DetailDrawer
        open={!!current}
        onClose={() => setSelected(null)}
        title="사용자 상세"
        description="가상의 계정 정보 · 실제 사용자 데이터가 아닙니다."
        footer={
          current && (
            <>
              <Button variant="outline" onClick={() => setConfirm("revoke")}>
                <KeyRound size={16} />
                세션 철회 시뮬레이션
              </Button>
              <Button
                variant={
                  current.status === "suspended" ? "default" : "destructive"
                }
                onClick={() => setConfirm("status")}
              >
                <ShieldOff size={16} />
                {current.status === "suspended"
                  ? "계정 활성화"
                  : "계정 정지"}{" "}
                시뮬레이션
              </Button>
            </>
          )
        }
      >
        {current && (
          <>
            <div className="detail-identity">
              <span className="user-avatar large">
                {current.name.slice(0, 1)}
              </span>
              <h2>{current.name}</h2>
              <p>{current.email}</p>
              <StatusBadge status={current.status} />
            </div>
            <dl className="detail-grid">
              <dt>사용자 ID</dt>
              <dd>{current.id}</dd>
              <dt>가입일</dt>
              <dd>{timestamp(current.joinedAt)} KST</dd>
              <dt>최근 활동</dt>
              <dd>
                {current.lastActive
                  ? timestamp(current.lastActive) + " KST"
                  : "아직 활동 없음"}
              </dd>
              <dt>데이터 출처</dt>
              <dd>로컬 샘플 데이터</dd>
            </dl>
            <div className="callout">
              관리 작업은 이 브라우저 메모리에서만 시뮬레이션됩니다. 새로고침 시
              원래 샘플로 돌아갑니다.
            </div>
          </>
        )}
      </DetailDrawer>
      <ConfirmDialog
        open={!!confirm && !!current}
        onClose={() => setConfirm(null)}
        title={
          confirm === "status"
            ? "계정 상태를 변경할까요?"
            : "세션 철회를 시뮬레이션할까요?"
        }
        description={`${current?.name ?? ""} (${current?.id ?? ""})에 대한 데모 작업입니다.`}
        destructive={confirm === "status" && current?.status !== "suspended"}
        onConfirm={() => {
          if (current) {
            if (confirm === "status") simulateStatus(current.id);
            else simulateRevoke(current.id);
          }
        }}
      />
    </>
  );
}
