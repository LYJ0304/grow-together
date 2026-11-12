import { StyleSheet, Text, View } from 'react-native';
import { editorial } from '../../theme/editorial';
import { colors } from '../../theme/colors';
import { typography } from '../typography';
import { ActionButton } from '../action-button';
import { MotionPressable } from '../motion-pressable';
import type {
  ReportSuggestion,
  WeeklyReportResource,
} from '../../lib/features/report/view-model';

export function ReportContent({
  resource,
  generating = false,
  onRetry,
  onGenerate,
  onMemory,
  onSuggestion,
  onRecords,
  onSchedule,
  onLogin,
}: {
  resource: WeeklyReportResource;
  generating?: boolean;
  onRetry?: () => void;
  onGenerate?: () => void;
  onMemory?: (date: string) => void;
  onSuggestion?: (suggestion: ReportSuggestion) => void;
  onRecords: () => void;
  onSchedule: () => void;
  onLogin: () => void;
}) {
  if (resource.state !== 'ready')
    return (
      <View
        style={[styles.card, resource.state === 'unavailable' && styles.tint]}
      >
        <Text style={editorial.eyebrow}>OUR WEEKLY STORY</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          {resource.state === 'loading'
            ? '한 주의 기록을 불러오고 있어요'
            : resource.state === 'error'
              ? '리포트를 불러오지 못했어요'
              : resource.state === 'loginRequired'
                ? '로그인하고 기록을 돌아보세요'
                : '리포트를 준비하고 있어요'}
        </Text>
        <Text
          accessibilityRole={resource.state === 'error' ? 'alert' : undefined}
          style={styles.body}
        >
          {resource.state === 'error'
            ? resource.message
            : resource.state === 'loginRequired'
              ? '리포트는 로그인한 계정의 기록을 바탕으로 제공해요.'
              : resource.state === 'loading'
                ? '잠시만 기다려주세요.'
                : '저장한 일정과 일기는 기존 화면에서 확인할 수 있어요.'}
        </Text>
        {resource.state === 'loginRequired' ? (
          <ActionButton label="로그인하러 가기" onPress={onLogin} />
        ) : resource.state === 'error' && onRetry ? (
          <ActionButton label="리포트 다시 불러오기" onPress={onRetry} />
        ) : resource.state !== 'loading' ? (
          <>
            <ActionButton label="일정 확인하기" onPress={onSchedule} />
            <ActionButton label="기록 남기기" tone="rose" onPress={onRecords} />
          </>
        ) : null}
      </View>
    );
  const report = resource.report;
  const empty = report.completed === 0 && report.diaryDays === 0;
  const peak = Math.max(1, ...report.daily.map((day) => day.completed));
  return (
    <View style={styles.sections}>
      <View style={[styles.card, styles.tint]}>
        <Text style={styles.eyebrow}>
          {report.current ? '기록이 쌓이는 이번 주' : '한 주의 회고'}
        </Text>
        <Text accessibilityRole="header" style={styles.heading}>
          {empty ? '아직 돌아볼 기록이 없어요' : '이번 주도 함께 자랐어요'}
        </Text>
        <Text style={styles.body}>
          {empty
            ? '첫 일정을 완료하거나 하루의 기억을 남기면 이곳에서 함께한 시간을 돌아볼 수 있어요.'
            : `완료로 기록한 활동 ${report.completed}개와 일기를 남긴 ${report.diaryDays}일을 돌아봐요.`}
        </Text>
        {empty ? (
          <ActionButton label="기록 남기기" tone="rose" onPress={onRecords} />
        ) : null}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          활동 돌아보기
        </Text>
        <View style={styles.metrics}>
          {[
            ['계획한 활동', report.planned],
            ['완료 기록', report.completed],
            ['일기를 남긴 날', report.diaryDays],
          ].map(([label, value]) => (
            <View key={label} style={styles.metric}>
              <Text style={styles.value}>{value}</Text>
              <Text style={styles.caption}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.caption}>
          {report.completionRate === null
            ? '아직 비율을 계산할 활동이 없어요.'
            : `분석 대상 ${report.eligible}개 중 완료 기록 ${report.completionRate}%`}
        </Text>
        {report.current ? (
          <Text style={styles.caption}>
            미래에 예정된 활동은 비율 계산에서 제외해요.
          </Text>
        ) : null}
        {!empty ? (
          <View style={styles.chart}>
            {report.daily.map((day) => (
              <View
                key={day.date}
                accessible
                accessibilityLabel={`${day.date} 완료 기록 ${day.completed}개`}
                style={styles.day}
              >
                <Text style={styles.caption}>{day.completed}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: (day.completed / peak) * 48 },
                    ]}
                  />
                </View>
                <Text style={styles.caption}>{day.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {report.activities.map((activity) => (
          <View key={activity.name} style={styles.activity}>
            <Text style={[styles.body, styles.flex]}>{activity.name}</Text>
            <Text style={styles.caption}>{activity.count}회 기록</Text>
          </View>
        ))}
        <Text style={styles.caption}>
          완료 기록은 아이의 발달 평가가 아니에요.
        </Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          이번 주의 기억
        </Text>
        {report.memories.length ? (
          report.memories.map((memory) => (
            <View key={memory.id} style={styles.card}>
              <Text style={styles.eyebrow}>{memory.date} · 저장된 일기</Text>
              <Text style={styles.body}>{memory.excerpt}</Text>
              {memory.activities.length ? (
                <Text style={styles.caption}>
                  {memory.activities.join(' · ')}
                </Text>
              ) : null}
              <MotionPressable
                accessibilityRole="button"
                disabled={!onMemory}
                onPress={() => onMemory?.(memory.date)}
                style={styles.link}
              >
                <Text style={styles.linkText}>원본 일기 보기</Text>
              </MotionPressable>
            </View>
          ))
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              아직 이번 주의 기록이 없어요. 아이와 함께한 작은 순간부터
              남겨보세요.
            </Text>
            <ActionButton label="기록 남기기" tone="rose" onPress={onRecords} />
          </View>
        )}
      </View>
      {!empty ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            AI가 발견한 이번 주의 이야기
          </Text>
          <Text style={styles.caption}>
            AI가 기록을 바탕으로 정리한 내용이에요.
          </Text>
          {report.insight.state === 'ready' ? (
            <View style={styles.card}>
              <Text style={styles.body}>{report.insight.summary}</Text>
              {report.insight.observations.map((text, index) => (
                <Text key={index} style={styles.body}>
                  {text}
                </Text>
              ))}
              {report.insight.suggestions
                .slice(0, 2)
                .map((suggestion, index) => (
                  <View key={index} style={styles.suggestion}>
                    <Text style={styles.subheading}>{suggestion.title}</Text>
                    <Text style={styles.body}>{suggestion.description}</Text>
                    <Text style={styles.caption}>{suggestion.reason}</Text>
                    <ActionButton
                      label="이 활동으로 일정 준비하기"
                      tone="petal"
                      disabled={!onSuggestion}
                      onPress={() => onSuggestion?.(suggestion)}
                    />
                  </View>
                ))}
            </View>
          ) : (
            <Text
              accessibilityRole={
                report.insight.state === 'error' ? 'alert' : undefined
              }
              style={styles.body}
            >
              {report.insight.state === 'insufficient'
                ? '이야기를 정리할 기록이 아직 부족해요. 확인할 수 있는 활동과 기억만 보여드려요.'
                : report.insight.state === 'error'
                  ? 'AI 이야기를 만들지 못했어요. 활동과 일기 기록은 계속 확인할 수 있어요.'
                  : report.insight.state === 'unavailable'
                    ? '지금은 AI 이야기를 이용할 수 없어요.'
                    : '원할 때 이번 주 기록을 AI와 함께 정리해보세요.'}
            </Text>
          )}
          {onGenerate &&
          report.insight.state !== 'insufficient' &&
          report.insight.state !== 'unavailable' ? (
            <ActionButton
              label={
                generating
                  ? 'AI 이야기 만드는 중…'
                  : report.insight.state === 'ready'
                    ? 'AI 이야기 다시 만들기'
                    : 'AI 이야기 만들기'
              }
              disabled={generating}
              onPress={onGenerate}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  sections: { gap: 28 },
  section: { gap: 12 },
  card: {
    ...editorial.card,
    gap: 14,
  },
  tint: { backgroundColor: colors.tint },
  heading: { ...typography.section, color: colors.text },
  subheading: { ...typography.button, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  eyebrow: { ...typography.caption, color: colors.onTint },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, minWidth: 74, gap: 4 },
  value: { ...typography.title, color: colors.brand },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    paddingVertical: 8,
  },
  day: { alignItems: 'center', flex: 1, gap: 4 },
  barTrack: { height: 48, justifyContent: 'flex-end', width: 14 },
  bar: { backgroundColor: colors.brand, borderRadius: 7, width: 14 },
  activity: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.label, color: colors.primary },
  suggestion: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
