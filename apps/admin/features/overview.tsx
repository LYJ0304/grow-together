"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  UserCheck,
  Sparkles,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import {
  PageHeader,
  MetricCard,
  Panel,
  DateRangeFilter,
  DemoBoundary,
  StatusBadge,
} from "@/components/shared/primitives";
import { ResponsiveChart } from "@/components/shared/responsive-chart";
import { useDemo } from "@/lib/demo-context";
import { useDemoQuery } from "@/lib/use-demo-query";
import { adminDemoRepository } from "@/lib/mock/repository";
import { featureDefinitions } from "@/lib/mock/fixtures";
import { currency, number, timestamp } from "@/lib/utils";
import type { DateRange } from "@/lib/types/admin";
export function Overview() {
  const [range, setRange] = useState<DateRange>(7);
  const { users, audit } = useDemo();
  const query = useDemoQuery(
    useCallback(
      () => adminDemoRepository.overview(range, users),
      [range, users],
    ),
  );
  const d = query.data;
  return (
    <>
      <PageHeader
        title="Overview"
        description="서비스의 흐름을 한눈에. 사용자와 AI 운영 현황을 살펴보세요."
      >
        <DateRangeFilter value={range} onChange={setRange} />
      </PageHeader>
      <DemoBoundary loading={query.loading} error={query.error}>
        {d && (
          <>
            <div className="metrics-grid">
              <MetricCard
                label="전체 사용자"
                value={number(d.users)}
                note="샘플 계정 · 전체 기간"
                icon={<Users size={16} />}
              />
              <MetricCard
                label="신규 가입자"
                value={number(d.newUsers)}
                note="최근 7일 · 가상 데이터"
                icon={<UserPlus size={16} />}
              />
              <MetricCard
                label="활성 사용자"
                value={number(d.activeUsers)}
                note="최근 7일 · 샘플 활동"
                icon={<UserCheck size={16} />}
              />
              <MetricCard
                label="AI 요청 수"
                value={number(d.ai.total)}
                note={`최근 ${range}일 · 샘플 요청`}
                icon={<Sparkles size={16} />}
              />
              <MetricCard
                label="AI 성공률"
                value={`${d.ai.successRate.toFixed(1)}%`}
                note={`${number(d.ai.success)} / ${number(d.ai.total)}건 · Demo`}
                icon={<CheckCircle2 size={16} />}
              />
              <MetricCard
                label="AI 예상 비용"
                value={currency(d.ai.cost)}
                note={`최근 ${range}일 · 가상 추정치`}
                icon={<Wallet size={16} />}
              />
            </div>
            <div className="two-column">
              <Panel
                title="가입자 추이"
                description={`최근 ${range}일 · KST 기준`}
                action={<span className="quiet-label">DAILY SIGNUPS</span>}
              >
                <ResponsiveChart
                  title="가입자 추이"
                  data={d.signups}
                  series={[
                    {
                      key: "signups",
                      name: "신규 가입",
                      color: "var(--brand)",
                    },
                  ]}
                />
              </Panel>
              <Panel
                title="AI 기능별 사용량"
                description="Planned 기능도 샘플 수치에 포함됩니다."
                action={
                  <Link className="text-link" href="/ai">
                    AI 운영 <ArrowUpRight size={14} />
                  </Link>
                }
              >
                <ResponsiveChart
                  title="AI 기능별 가상 사용량"
                  data={d.usage}
                  bar
                  series={[
                    { key: "value", name: "요청", color: "var(--brand)" },
                  ]}
                />
              </Panel>
            </div>
            <div className="two-column bottom-panels">
              <Panel
                title="시스템 상태"
                description="실제 모니터링이 아닌 샘플 스냅샷"
                action={
                  <Link className="text-link" href="/system">
                    상세 <ArrowUpRight size={14} />
                  </Link>
                }
              >
                <div className="compact-list">
                  {d.services.map((s) => (
                    <Link className="service-row" href="/system" key={s.id}>
                      <span className="service-symbol">
                        <samp>
                          {s.id === "api"
                            ? "API"
                            : s.id === "worker"
                              ? "AI"
                              : s.name === "PostgreSQL"
                                ? "DB"
                                : "S3"}
                        </samp>
                      </span>
                      <span className="row-grow">
                        <strong>{s.name}</strong>
                        <small>{s.latencyMs} ms · Demo</small>
                      </span>
                      <StatusBadge status={s.status} />
                    </Link>
                  ))}
                </div>
              </Panel>
              <Panel
                title="최근 AI 오류"
                description="가상의 오류 코드 · 민감한 요청 내용 제외"
                action={<span className="count-pill">{d.errors.length}</span>}
              >
                <div className="compact-list">
                  {d.errors.map((e) => (
                    <div className="error-row" key={e.id}>
                      <AlertCircle size={16} />
                      <div className="row-grow">
                        <strong>{e.code}</strong>
                        <small>
                          {
                            featureDefinitions.find((f) => f.id === e.feature)
                              ?.name
                          }{" "}
                          · {timestamp(e.at)}
                        </small>
                      </div>
                      <span className="small-mono">{e.id}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel
              title="최근 관리자 활동"
              description="기본 샘플과 이 브라우저의 데모 작업"
              action={
                <Link className="text-link" href="/audit">
                  모든 로그 <ArrowUpRight size={14} />
                </Link>
              }
            >
              <div className="activity-list">
                {audit.slice(0, 4).map((e) => (
                  <div className="activity-row" key={e.id}>
                    <span className="activity-dot" />
                    <div className="row-grow">
                      <strong>{e.action}</strong>
                      <small>
                        {e.actor} · {e.target}
                      </small>
                    </div>
                    <time>{timestamp(e.at)}</time>
                    <StatusBadge status={e.result} />
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </DemoBoundary>
    </>
  );
}
