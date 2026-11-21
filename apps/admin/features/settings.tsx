"use client";
import { useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  PageHeader,
  Panel,
  StatusBadge,
  ConfirmDialog,
  DemoBoundary,
} from "@/components/shared/primitives";
import { useDemo } from "@/lib/demo-context";
import { defaultSettings, featureDefinitions } from "@/lib/mock/fixtures";
import type { DemoSettings } from "@/lib/types/admin";
export function SettingsScreen() {
  const { resetEpoch } = useDemo();
  return <SettingsForm key={resetEpoch} />;
}
function SettingsForm() {
  const { settings, saveSettings, reset } = useDemo();
  const [draft, setDraft] = useState<DemoSettings>(settings);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState("");
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      !draft.workspaceName.trim() ||
      !draft.operatorName.trim() ||
      !draft.operatorEmail.includes("@") ||
      !Number.isInteger(draft.dailyLimit) ||
      draft.dailyLimit < 1 ||
      !Number.isFinite(draft.monthlyBudget) ||
      draft.monthlyBudget <= 0
    ) {
      setError(
        "이름과 샘플 이메일, 1 이상의 정수 요청 한도, 0보다 큰 예산을 입력해 주세요.",
      );
      return;
    }
    setError("");
    saveSettings({
      ...draft,
      workspaceName: draft.workspaceName.trim(),
      operatorName: draft.operatorName.trim(),
      operatorEmail: draft.operatorEmail.trim(),
    });
  }
  return (
    <>
      <PageHeader
        title="Settings"
        description="워크스페이스와 운영 설정 UI를 확인하세요. 실제 서비스에는 적용되지 않습니다."
      />
      <DemoBoundary>
        <form className="settings-form" onSubmit={save}>
          <Panel
            title="General"
            description="콘솔에 표시할 샘플 워크스페이스 정보"
          >
            <div className="settings-fields">
              <label className="field">
                <span>워크스페이스 이름</span>
                <Input
                  required
                  maxLength={40}
                  value={draft.workspaceName}
                  onChange={(e) =>
                    setDraft({ ...draft, workspaceName: e.target.value })
                  }
                />
              </label>
              <div className="setting-info">
                <strong>Demo environment</strong>
                <p>
                  API 연결 없음 · 브라우저 메모리에만 저장 · 새로고침 시 초기화
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title="Feature Flags"
            description="토글은 샘플 설정만 변경합니다. 운영 환경의 기능을 켜거나 끄지 않습니다."
          >
            <div className="feature-list">
              {featureDefinitions.map((f) => (
                <div key={f.id} className="feature-row">
                  <div className="row-grow">
                    <label className="feature-label" htmlFor={`flag-${f.id}`}>
                      {f.name}
                    </label>
                    <p>{f.note}</p>
                  </div>
                  <StatusBadge status={f.implementation} />
                  <Switch
                    id={`flag-${f.id}`}
                    aria-label={`${f.name} 데모 설정`}
                    checked={draft.flags[f.id]}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        flags: { ...draft.flags, [f.id]: checked },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="AI Usage Limits"
            description="가상의 한도 값 · 실제 AI 요청이나 청구에 영향 없음"
          >
            <div className="settings-fields two-fields">
              <label className="field">
                <span>일일 요청 한도</span>
                <Input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                  value={draft.dailyLimit || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dailyLimit: Number(e.target.value) })
                  }
                />
                <small>데모 요청 수 / 일</small>
              </label>
              <label className="field">
                <span>월 예상 예산 (USD)</span>
                <Input
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  value={draft.monthlyBudget || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      monthlyBudget: Number(e.target.value),
                    })
                  }
                />
                <small>AI 운영 화면의 비교 기준으로 사용</small>
              </label>
            </div>
          </Panel>
          <Panel
            title="Admin Profile"
            description="가상의 데모 작업자 · 실제 관리자 계정이 아닙니다."
          >
            <div className="settings-fields two-fields">
              <label className="field">
                <span>데모 작업자 이름</span>
                <Input
                  required
                  maxLength={40}
                  value={draft.operatorName}
                  onChange={(e) =>
                    setDraft({ ...draft, operatorName: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>샘플 이메일</span>
                <Input
                  type="email"
                  required
                  value={draft.operatorEmail}
                  onChange={(e) =>
                    setDraft({ ...draft, operatorEmail: e.target.value })
                  }
                />
                <small>실제 개인정보를 입력하지 마세요.</small>
              </label>
            </div>
          </Panel>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-save">
            <p>저장해도 실제 운영 설정은 변경되지 않습니다.</p>
            <Button type="submit">
              <Save size={16} />
              데모 설정 저장
            </Button>
          </div>
        </form>
        <section className="reset-section">
          <div>
            <h2>샘플 데이터 초기화</h2>
            <p>사용자, 설정, 로컬 감사 로그를 처음 상태로 돌립니다.</p>
          </div>
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} />
            초기화
          </Button>
        </section>
      </DemoBoundary>
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="샘플 데이터를 초기화할까요?"
        description="이 브라우저에서 수정한 데모 설정과 계정 상태를 초기화합니다."
        onConfirm={() => {
          reset();
          setDraft(defaultSettings);
        }}
      />
    </>
  );
}
