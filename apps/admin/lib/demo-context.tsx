"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  defaultSettings,
  demoUsers,
  demoAudit,
  MOCK_NOW,
} from "./mock/fixtures";
import type { User, AuditEvent, DemoSettings, DemoView } from "./types/admin";

type DemoContextValue = {
  resetEpoch: number;
  users: User[];
  audit: AuditEvent[];
  settings: DemoSettings;
  view: DemoView;
  setView: (value: DemoView) => void;
  notice: string;
  dismissNotice: () => void;
  simulateStatus: (id: string) => void;
  simulateRevoke: (id: string) => void;
  saveSettings: (settings: DemoSettings) => void;
  reset: () => void;
  startSession: () => void;
  endSession: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [resetEpoch, setResetEpoch] = useState(0);
  const [users, setUsers] = useState(demoUsers);
  const [audit, setAudit] = useState(demoAudit);
  const [settings, setSettings] = useState(defaultSettings);
  const [view, setView] = useState<DemoView>("ready");
  const [notice, setNotice] = useState("");
  function record(
    action: AuditEvent["action"],
    target: string,
    description: string,
  ) {
    setAudit((rows) => [
      {
        id: crypto.randomUUID(),
        at: MOCK_NOW,
        actor: settings.operatorName,
        action,
        target,
        result: "success",
        description,
      },
      ...rows,
    ]);
  }
  function reset() {
    setResetEpoch((epoch) => epoch + 1);
    setUsers(demoUsers);
    setAudit(demoAudit);
    setSettings(defaultSettings);
    setView("ready");
    setNotice("샘플 데이터가 초기화됐어요. 운영 데이터에는 영향이 없습니다.");
  }
  const value: DemoContextValue = {
    resetEpoch,
    users,
    audit,
    settings,
    view,
    setView,
    notice,
    dismissNotice: () => setNotice(""),
    simulateStatus(id) {
      setUsers((rows) =>
        rows.map((row) =>
          row.id === id
            ? {
                ...row,
                status: row.status === "suspended" ? "active" : "suspended",
              }
            : row,
        ),
      );
      record(
        "user.status",
        id,
        "이 브라우저 메모리에서 계정 상태 변경을 시뮬레이션했습니다.",
      );
      setNotice("데모 계정 상태만 변경했어요. 실제 계정에는 영향이 없습니다.");
    },
    simulateRevoke(id) {
      record(
        "session.revoke",
        id,
        "세션 철회 UI를 시뮬레이션했습니다. 실제 세션은 변경하지 않았습니다.",
      );
      setNotice(
        "세션 철회를 시뮬레이션했어요. 실제 세션은 변경하지 않았습니다.",
      );
    },
    saveSettings(next) {
      setSettings(next);
      record(
        "settings.update",
        "Demo workspace",
        "데모 설정을 메모리에 저장했습니다.",
      );
      setNotice(
        "이 페이지의 샘플 설정만 저장했어요. 새로고침하면 초기화됩니다.",
      );
    },
    reset,
    startSession() {
      sessionStorage.setItem("grow-admin-demo", "active");
      record(
        "demo.start",
        "Demo workspace",
        "실제 인증 없이 데모 화면을 시작했습니다.",
      );
    },
    endSession() {
      sessionStorage.removeItem("grow-admin-demo");
      reset();
    },
  };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is required");
  return value;
}
