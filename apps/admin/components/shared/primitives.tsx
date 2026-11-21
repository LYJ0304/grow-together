"use client";
import { type ReactNode, useId, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Inbox,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useDemo } from "@/lib/demo-context";
import type { DateRange } from "@/lib/types/admin";
import { cn } from "@/lib/utils";
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">GROW TOGETHER / DEMO WORKSPACE</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <section className="metric">
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{note}</p>
    </section>
  );
}
const statuses: Record<string, { label: string; kind: string }> = {
  healthy: { label: "Healthy", kind: "success" },
  degraded: { label: "Degraded", kind: "warning" },
  down: { label: "Down", kind: "danger" },
  active: { label: "활성", kind: "success" },
  suspended: { label: "정지", kind: "danger" },
  invited: { label: "초대됨", kind: "neutral" },
  success: { label: "성공 · Demo", kind: "success" },
  failed: { label: "실패 · Demo", kind: "danger" },
  planned: { label: "Planned", kind: "neutral" },
  available: { label: "구현 경로 있음", kind: "neutral" },
};
export function StatusBadge({ status }: { status: string }) {
  const value = statuses[status] ?? { label: status, kind: "neutral" };
  return (
    <span className={cn("status", `status-${value.kind}`)}>
      <span className="status-dot" />
      {value.label}
    </span>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel", className)}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const id = useId();
  return (
    <label className="field inline-field" htmlFor={id}>
      <span>기간</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as DateRange)}
      >
        {[7, 14, 30].map((days) => (
          <option key={days} value={days}>
            최근 {days}일
          </option>
        ))}
      </select>
    </label>
  );
}
export function FilterBar({
  search,
  onSearch,
  placeholder,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-bar">
      <div className="search-field">
        <Search size={16} />
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="desktop-filters">{children}</div>
      {children && (
        <Button
          variant="outline"
          className="mobile-filter-button"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal size={16} />
          필터
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>목록 필터</SheetTitle>
            <SheetDescription>
              같은 샘플 데이터에 필터를 적용합니다.
            </SheetDescription>
          </SheetHeader>
          <div className="sheet-body filter-stack">{open && children}</div>
          <SheetFooter>
            <Button onClick={() => setOpen(false)}>필터 적용</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function EmptyState({
  title = "표시할 항목이 없어요",
  description = "검색어나 필터를 바꿔 다시 확인해 보세요.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <Inbox size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state-panel" role="alert">
      <TriangleAlert size={28} />
      <h2>데모 오류 상태</h2>
      <p>오류 UI를 미리 보고 있습니다. 실제 서비스 장애가 아닙니다.</p>
      <Button variant="outline" onClick={onRetry}>
        정상 샘플로 돌아가기
      </Button>
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div role="status" aria-label="샘플 화면 로딩 중" className="skeleton-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
      <span className="sr-only">샘플 화면을 준비하고 있어요</span>
    </div>
  );
}
export function DemoBoundary({
  loading = false,
  error = false,
  children,
}: {
  loading?: boolean;
  error?: boolean;
  children: ReactNode;
}) {
  const { view, setView } = useDemo();
  if (view === "loading" || loading) return <LoadingSkeleton />;
  if (view === "error" || error)
    return <ErrorState onRetry={() => setView("ready")} />;
  if (view === "empty")
    return (
      <EmptyState
        title="데이터가 없는 화면 미리보기"
        description="빈 상태 UI를 확인하고 있습니다. 원본 샘플은 삭제되지 않습니다."
        action={
          <Button variant="outline" onClick={() => setView("ready")}>
            샘플 다시 보기
          </Button>
        }
      />
    );
  return children;
}
export function DetailDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="sheet-body">{children}</div>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  onConfirm,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description} 실제 서버 작업은 실행하지 않습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white" : ""}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            데모에서 확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  sort?: () => void;
  direction?: "ascending" | "descending";
};
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  renderMobile,
  onSelect,
}: {
  rows: T[];
  columns: Column<T>[];
  renderMobile: (row: T) => ReactNode;
  onSelect: (row: T) => void;
}) {
  return (
    <>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} aria-sort={column.direction}>
                  {column.sort ? (
                    <button className="sort-button" onClick={column.sort}>
                      {column.title}
                      {column.direction === "ascending" ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )}
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column, i) => (
                  <td key={column.key}>
                    {i === 0 ? (
                      <button
                        className="table-row-link"
                        onClick={() => onSelect(row)}
                      >
                        {column.render(row)}
                      </button>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list">
        {rows.map((row) => (
          <button
            key={row.id}
            className="mobile-list-item"
            onClick={() => onSelect(row)}
          >
            {renderMobile(row)}
            <ChevronRight size={16} className="list-chevron" />
          </button>
        ))}
      </div>
    </>
  );
}
export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (value: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="목록 페이지">
      <span>
        총 {total}개 · {page} / {pageCount}
      </span>
      <div>
        <Button
          variant="outline"
          size="icon"
          aria-label="이전 페이지"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="다음 페이지"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
