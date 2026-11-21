"use client";
import { useCallback, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Coins,
  Wallet,
} from "lucide-react";
import {
  PageHeader,
  MetricCard,
  Panel,
  DateRangeFilter,
  DemoBoundary,
  StatusBadge,
  EmptyState,
  DetailDrawer,
} from "@/components/shared/primitives";
import { ResponsiveChart } from "@/components/shared/responsive-chart";
import { adminDemoRepository } from "@/lib/mock/repository";
import { featureDefinitions } from "@/lib/mock/fixtures";
import { useDemoQuery } from "@/lib/use-demo-query";
import { useDemo } from "@/lib/demo-context";
import { number, currency, timestamp } from "@/lib/utils";
import type {
  AiRequest,
  DateRange,
  FeatureId,
  RequestStatus,
} from "@/lib/types/admin";
export function AiScreen() {
  const [range, setRange] = useState<DateRange>(7);
  const [feature, setFeature] = useState<FeatureId | "all">("all");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [selected, setSelected] = useState<AiRequest | null>(null);
  const { settings } = useDemo();
  const query = useDemoQuery(
    useCallback(
      () => adminDemoRepository.ai(range, feature, status),
      [range, feature, status],
    ),
  );
  const d = query.data;
  return (
    <>
      <PageHeader
        title="AI Operations"
        description="기능별 사용량과 품질 지표를 확인하는 운영 화면입니다."
      >
        <DateRangeFilter value={range} onChange={setRange} />
      </PageHeader>
      <div className="ai-filters">
        <label className="field">
          <span>AI 기능</span>
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value as typeof feature)}
          >
            <option value="all">모든 기능</option>
            {featureDefinitions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>요청 상태</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">모든 상태</option>
            <option value="success">성공</option>
            <option value="failed">실패</option>
          </select>
        </label>
        <span className="filter-caption">
          가상 요청 · 실제 AI를 호출하지 않습니다.
        </span>
      </div>
      <DemoBoundary loading={query.loading} error={query.error}>
        {d && (
          <>
            <div className="metrics-grid">
              <MetricCard
                label="전체 AI 요청"
                value={number(d.stats.total)}
                note={`최근 ${range}일 · 선택한 필터 기준`}
                icon={<Sparkles size={16} />}
              />
              <MetricCard
                label="성공률"
                value={`${d.stats.successRate.toFixed(1)}%`}
                note={`${d.stats.success}건 · Demo`}
                icon={<CheckCircle2 size={16} />}
              />
              <MetricCard
                label="실패율"
                value={`${(d.stats.total ? (d.stats.failed / d.stats.total) * 100 : 0).toFixed(1)}%`}
                note={`${d.stats.failed}건 · Demo`}
                icon={<AlertTriangle size={16} />}
              />
              <MetricCard
                label="평균 응답시간"
                value={`${(d.stats.latency / 1000).toFixed(2)}s`}
                note="가상 지연시간 · 실측 아님"
                icon={<Timer size={16} />}
              />
              <MetricCard
                label="토큰 사용량"
                value={number(d.stats.tokens)}
                note="샘플 입력·출력 합계"
                icon={<Coins size={16} />}
              />
              <MetricCard
                label="예상 비용"
                value={currency(d.stats.cost)}
                note="가상 단가 적용 · 청구 금액 아님"
                icon={<Wallet size={16} />}
              />
            </div>
            <div className="two-column">
              <Panel
                title="요청 및 성공·실패 추이"
                description={`최근 ${range}일 · KST 기준`}
              >
                <ResponsiveChart
                  title="AI 요청 추이"
                  data={d.series}
                  series={[
                    { key: "requests", name: "전체", color: "var(--brand)" },
                    { key: "success", name: "성공", color: "var(--success)" },
                    { key: "failed", name: "실패", color: "var(--danger)" },
                  ]}
                />
              </Panel>
              <Panel
                title="기능별 사용량"
                description="선택한 기간과 상태 필터 적용"
              >
                <ResponsiveChart
                  title="기능별 사용량"
                  data={d.usage}
                  bar
                  series={[
                    { key: "value", name: "요청", color: "var(--brand)" },
                  ]}
                />
              </Panel>
            </div>
            <Panel
              title="기능 구현 상태"
              description="저장소 기준 기능 상태입니다. 이 콘솔에는 어떤 서비스도 연결되지 않았습니다."
            >
              <div className="feature-list">
                {featureDefinitions.map((f) => (
                  <div key={f.id} className="feature-row">
                    <div className="row-grow">
                      <strong>{f.name}</strong>
                      <p>{f.note}</p>
                    </div>
                    <StatusBadge status={f.implementation} />
                  </div>
                ))}
              </div>
            </Panel>
            <div className="two-column">
              <Panel
                title="최근 AI 오류"
                description="샘플 오류만 표시 · 요청 본문은 수집하지 않음"
              >
                {d.errors.length ? (
                  <div className="compact-list">
                    {d.errors.map((e) => (
                      <button
                        className="error-row error-button"
                        key={e.id}
                        onClick={() => setSelected(e)}
                      >
                        <AlertTriangle size={16} />
                        <span className="row-grow">
                          <strong>{e.code}</strong>
                          <small>
                            {
                              featureDefinitions.find((f) => f.id === e.feature)
                                ?.name
                            }{" "}
                            · {timestamp(e.at)}
                          </small>
                        </span>
                        <span className="small-mono">상세 →</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="선택한 조건에 오류가 없어요"
                    description="샘플 요청 중 실패한 항목이 없습니다."
                  />
                )}
              </Panel>
              <Panel
                title="데모 사용 한도"
                description="설정 화면의 샘플 한도 · 실제 요청을 제한하지 않습니다."
              >
                <div className="budget-block">
                  <div>
                    <span>선택 기간 예상 비용 / 월 샘플 예산</span>
                    <strong>
                      {currency(d.stats.cost)} /{" "}
                      {currency(settings.monthlyBudget)}
                    </strong>
                  </div>
                  <progress
                    aria-label="샘플 예산 대비 예상 비용"
                    max={settings.monthlyBudget}
                    value={Math.min(d.stats.cost, settings.monthlyBudget)}
                  />
                  <p>
                    기간별 비교용 수치입니다. 실제 월별 청구 정보가 아닙니다.
                  </p>
                  <div className="budget-limit">
                    <span>일일 요청 한도 (데모 설정)</span>
                    <strong>{number(settings.dailyLimit)}건</strong>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}
      </DemoBoundary>
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="AI 오류 상세"
        description="가상 오류 이벤트 · 실제 Worker 로그가 아닙니다."
      >
        {selected && (
          <dl className="detail-grid">
            <dt>Request ID</dt>
            <dd>{selected.id}</dd>
            <dt>기능</dt>
            <dd>
              {featureDefinitions.find((f) => f.id === selected.feature)?.name}
            </dd>
            <dt>발생 시각</dt>
            <dd>{timestamp(selected.at)} KST</dd>
            <dt>오류 코드</dt>
            <dd>{selected.code}</dd>
            <dt>응답시간</dt>
            <dd>{selected.latencyMs} ms</dd>
            <dt>상태</dt>
            <dd>
              <StatusBadge status={selected.status} />
            </dd>
          </dl>
        )}
      </DetailDrawer>
    </>
  );
}
