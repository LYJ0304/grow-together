"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Activity,
  ScrollText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogIn,
  RotateCcw,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/primitives";
import { useDemo } from "@/lib/demo-context";
import type { DemoView } from "@/lib/types/admin";
import { cn } from "@/lib/utils";
const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/ai", label: "AI Operations", icon: Sparkles },
  { href: "/system", label: "System", icon: Activity },
  { href: "/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="관리자 메뉴" className="navigation">
      {navigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={path === item.href ? "page" : undefined}
          title={item.label}
        >
          <item.icon size={18} />
          <span className="nav-label">{item.label}</span>
          {path === item.href && <span className="nav-active-dot" />}
        </Link>
      ))}
    </nav>
  );
}
function Brand() {
  return (
    <Link href="/" className="brand">
      <Image src="/brand-mark.png" alt="" width={34} height={34} priority />
      <span className="nav-label">
        <strong>Grow Together</strong>
        <small>Admin Console</small>
      </span>
    </Link>
  );
}
export function MobileNavigation({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <SheetContent side="left" className="mobile-nav">
        <SheetHeader>
          <SheetTitle>Grow Together</SheetTitle>
          <SheetDescription>Admin Console · Demo</SheetDescription>
        </SheetHeader>
        <Navigation onNavigate={onClose} />
        <p className="mobile-nav-note">
          모든 데이터와 관리 작업은 샘플입니다.
          <br />
          실제 운영 서비스와 연결되지 않습니다.
        </p>
      </SheetContent>
    </Sheet>
  );
}
export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState<boolean | undefined>();
  const [resetOpen, setResetOpen] = useState(false);
  const { view, setView, notice, dismissNotice, settings, reset, endSession } =
    useDemo();
  const path = usePathname();
  const router = useRouter();
  const current =
    navigation.find((item) => item.href === path)?.label ?? "Overview";
  return (
    <div
      className={cn(
        "admin-shell",
        compact === true && "sidebar-compact",
        compact === false && "sidebar-expanded",
      )}
    >
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-group-label nav-label">WORKSPACE</div>
        <Navigation />
        <div className="sidebar-bottom">
          <div className="demo-workspace">
            <span className="demo-orbit">D</span>
            <span className="nav-label">
              <strong>Demo workspace</strong>
              <small>샘플 데이터만 사용</small>
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => setResetOpen(true)}
            title="데모 초기화"
            aria-label="데모 초기화"
          >
            <RotateCcw size={16} />
            <span className="nav-label">데모 초기화</span>
          </Button>
          <Link className="sidebar-login" href="/login" title="Mock 로그인">
            <LogIn size={16} />
            <span className="nav-label">Mock 로그인</span>
            <ArrowUpRight size={14} className="nav-label" />
          </Link>
          <small className="sidebar-version nav-label">
            Prototype / v0.1.0
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="top-header">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="메뉴 열기"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle"
            aria-label="사이드바 접기 또는 펼치기"
            onClick={() =>
              setCompact((value) =>
                value === undefined
                  ? matchMedia("(min-width:1024px)").matches
                  : !value,
              )
            }
          >
            {compact ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <div className="breadcrumbs">
            <span className="workspace-name">{settings.workspaceName}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="header-controls">
            <span className="demo-badge">Demo</span>
            <label className="scenario-control">
              <span className="sr-only">화면 상태 미리보기</span>
              <select
                aria-label="화면 상태 미리보기"
                value={view}
                onChange={(e) => setView(e.target.value as DemoView)}
              >
                <option value="ready">정상 화면</option>
                <option value="loading">로딩 UI</option>
                <option value="empty">빈 상태 UI</option>
                <option value="error">오류 UI</option>
              </select>
            </label>
            <Button
              variant="ghost"
              size="icon"
              className="avatar-button"
              aria-label="데모 프로필 설정"
              onClick={() => router.push("/settings")}
            >
              {settings.operatorName.slice(0, 1).toUpperCase()}
            </Button>
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-banner-dot" />
          <span>
            <strong>Frontend-only demo.</strong> 모든 수치는 가상 데이터이며
            실제 인증·운영 제어를 제공하지 않습니다.
          </span>
          <button
            onClick={() => {
              endSession();
              router.push("/login");
            }}
          >
            데모 나가기 <ArrowUpRight size={12} />
          </button>
        </div>
        <main id="main-content" tabIndex={-1} className="main-content">
          {children}
          <footer className="workspace-footer">
            <span>Grow Together Admin</span>
            <span>Snapshot · Nov 21, 2026 · KST</span>
          </footer>
        </main>
      </div>
      <MobileNavigation
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      {notice && (
        <div role="status" className="notice">
          <span>{notice}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="안내 닫기"
            onClick={dismissNotice}
          >
            <X size={16} />
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="데모 데이터를 초기화할까요?"
        description="이 브라우저에서 변경한 샘플 사용자, 설정, 감사 로그를 초기화합니다."
        onConfirm={reset}
      />
    </div>
  );
}
