"use client";
import { useCallback, useState } from "react";
import { Server, Cpu, Database, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Panel,
  DemoBoundary,
  StatusBadge,
  DetailDrawer,
} from "@/components/shared/primitives";
import { adminDemoRepository } from "@/lib/mock/repository";
import { useDemoQuery } from "@/lib/use-demo-query";
import { timestamp } from "@/lib/utils";
import type { Service } from "@/lib/types/admin";
export function SystemScreen() {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Service | null>(null);
  const load = useCallback(() => {
    void revision;
    return adminDemoRepository.services();
  }, [revision]);
  const query = useDemoQuery(load);
  const icons = [Server, Cpu, Database, HardDrive];
  return (
    <>
      <PageHeader
        title="System"
        description="인프라 상태와 오류를 점검하는 데모 모니터링 화면입니다."
      >
        <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
          <RefreshCw size={16} />
          샘플 다시 보기
        </Button>
      </PageHeader>
      <div className="callout system-callout">
        <span className="status-dot" />
        <div>
          <strong>실시간 연결 없음</strong>
          <p>
            API, Worker, 데이터베이스, 스토리지에 접속하지 않습니다. 아래 값은
            고정된 Demo 스냅샷입니다.
          </p>
        </div>
      </div>
      <DemoBoundary loading={query.loading} error={query.error}>
        <div className="system-grid">
          {query.data?.map((s, i) => {
            const Icon = icons[i];
            return (
              <button
                key={s.id}
                className="system-card"
                onClick={() => setSelected(s)}
              >
                <div className="system-card-top">
                  <span className="system-icon">
                    <Icon size={22} />
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <div className="system-latency">
                  <strong>
                    {s.latencyMs}
                    <span>ms</span>
                  </strong>
                  <small>가상 응답시간</small>
                </div>
                <div className="system-card-footer">
                  <span>샘플 확인 시각</span>
                  <time>{timestamp(s.checkedAt)} KST</time>
                </div>
                {s.error && <div className="system-error">{s.error}</div>}
              </button>
            );
          })}
        </div>
        <Panel
          title="상태 읽는 방법"
          description="상태는 의미 있는 텍스트와 색상으로 함께 구분합니다."
        >
          <div className="status-guide">
            <div>
              <StatusBadge status="healthy" />
              <p>정상 상태 샘플</p>
            </div>
            <div>
              <StatusBadge status="degraded" />
              <p>지연 또는 부분 장애 샘플</p>
            </div>
            <div>
              <StatusBadge status="down" />
              <p>사용 불가 상태 샘플</p>
            </div>
          </div>
        </Panel>
      </DemoBoundary>
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "서비스 상세"}
        description="Demo 서비스 상태 · 실제 상태 점검이 아닙니다."
      >
        {selected && (
          <>
            <dl className="detail-grid">
              <dt>서비스</dt>
              <dd>{selected.name}</dd>
              <dt>상태</dt>
              <dd>
                <StatusBadge status={selected.status} />
              </dd>
              <dt>확인 시각</dt>
              <dd>{timestamp(selected.checkedAt)} KST</dd>
              <dt>가상 응답시간</dt>
              <dd>{selected.latencyMs} ms</dd>
              <dt>최근 샘플 오류</dt>
              <dd>{selected.error ?? "오류 없음 (샘플)"}</dd>
            </dl>
            <div className="callout">
              실제 서비스 점검 API는 향후 연동해야 합니다. 새로 보기는 같은 샘플
              데이터를 다시 읽습니다.
            </div>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
