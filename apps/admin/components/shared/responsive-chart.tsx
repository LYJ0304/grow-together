"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useReducedMotion } from "@/lib/use-reduced-motion";
type Row = { label: string; [key: string]: string | number };
export function ResponsiveChart({
  title,
  data,
  series,
  bar = false,
}: {
  title: string;
  data: Row[];
  series: { key: string; name: string; color: string }[];
  bar?: boolean;
}) {
  const reduced = useReducedMotion();
  const common = {
    data,
    margin: { top: 12, right: 12, left: -24, bottom: 0 },
    accessibilityLayer: true,
  };
  return (
    <figure className="chart-figure" aria-label={title}>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {bar ? (
            <BarChart {...common}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                interval={bar ? 0 : undefined}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                trigger="click"
                contentStyle={{
                  borderRadius: 8,
                  borderColor: "var(--border)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.color}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={!reduced}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart {...common}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                trigger="click"
                contentStyle={{
                  borderRadius: 8,
                  borderColor: "var(--border)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!reduced}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption>
        가상 데이터 · 차트를 누르거나 키보드 방향키로 값을 확인하세요.
      </figcaption>
      <details className="chart-data">
        <summary>표로 보기</summary>
        <div className="chart-data-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜 / 기능</th>
                {series.map((s) => (
                  <th key={s.key}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {series.map((s) => (
                    <td key={s.key}>{row[s.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
