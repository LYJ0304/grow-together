import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth-provider';
import { ActionButton } from './action-button';
import { createTodoApi } from '../lib/features/todo/todoApi';
import type { SchedulePreview, TodoResponse } from '../lib/features/todo/types';
import { ApiError } from '../lib/api/errors';
import { colors } from '../theme/colors';
import { useReduceMotion } from '../theme/motion';

export function ScheduleGenerationModal({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose(): void;
  onSaved(): void;
}) {
  const { client, status, epoch, accountKey } = useAuth();
  const [instructions, setInstructions] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState<'generate' | 'save' | 'check' | null>(null);
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [serverRows, setServerRows] = useState<TodoResponse[] | null>(null);
  const pending = useRef(false),
    alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const reduced = useReduceMotion();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const current = () =>
    alive.current &&
    client.getSnapshot().epoch === epoch &&
    client.getSnapshot().accountKey === accountKey;
  const api = createTodoApi(client);
  const generate = async () => {
    if (pending.current || uncertain || status !== 'authenticated') return;
    const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!pattern.test(start) || !pattern.test(end) || start >= end) {
      setNotice(
        '시작·종료 시간을 09:00처럼 입력해주세요. 종료는 시작보다 뒤여야 해요.',
      );
      return;
    }
    pending.current = true;
    setBusy('generate');
    setNotice('');
    controller.current = new AbortController();
    try {
      const result = await api.generateSchedule(
        {
          date,
          instructions: instructions.trim(),
          availableWindows: [{ start: start + ':00', end: end + ':00' }],
        },
        controller.current.signal,
      );
      if (!current()) return;
      if (
        result.date !== date ||
        !Array.isArray(result.candidates) ||
        !Array.isArray(result.unscheduled)
      )
        throw new Error('생성 결과를 확인하지 못했어요. 다시 생성해주세요.');
      setPreview(result);
      setSelected(result.candidates.map((_, i) => i));
    } catch (e) {
      if (current())
        setNotice(
          e instanceof ApiError && e.status === 409
            ? '기존 일정의 소요 시간을 먼저 입력하고 최신 일정·개인화 설정을 확인해주세요.'
            : e instanceof Error
              ? e.message
              : '생성하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const save = async () => {
    if (pending.current || uncertain || !preview || !selected.length) return;
    pending.current = true;
    setBusy('save');
    setNotice('');
    const candidates = preview.candidates.filter((_, i) =>
      selected.includes(i),
    );
    try {
      const result = await api.saveSchedule(date, candidates);
      if (!current()) return;
      if (
        !Array.isArray(result) ||
        result.length !== candidates.length ||
        result.some((t) => !Number.isInteger(t.id))
      )
        throw new ApiError(
          502,
          'INVALID_RESULT',
          '저장 결과를 확인하지 못했어요.',
        );
      onSaved();
      onClose();
    } catch (e) {
      if (current()) {
        const lost =
          e instanceof ApiError && (e.status === 0 || e.status >= 500);
        setUncertain(lost);
        setNotice(
          lost
            ? '저장 여부가 불확실해요. 중복 저장을 막기 위해 목록에서 결과를 먼저 확인해주세요.'
            : e instanceof ApiError && e.status === 409
              ? '최신 일정이나 개인화 설정과 충돌해 저장하지 않았어요. 후보는 유지했어요. 목록을 확인하고 다시 생성해주세요.'
              : e instanceof Error
                ? e.message
                : '저장하지 못했어요. 후보는 유지했어요.',
        );
      }
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const inspect = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy('check');
    try {
      const rows = await api.getTodos(date);
      if (current()) setServerRows(rows);
    } catch {
      if (current())
        setNotice(
          '목록을 확인하지 못했어요. 다시 확인해주세요. 후보는 유지했어요.',
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(null);
    }
  };
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
  };
  return (
    <Modal
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={() => {
        if (busy !== 'save') onClose();
      }}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            maxHeight: '95%',
            width: '100%',
            maxWidth: 480,
            alignSelf: 'center',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              gap: 16,
              backgroundColor: colors.surface,
              borderRadius: 20,
            }}
            accessibilityViewIsModal
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, color: colors.text }}
            >
              AI 일정 미리보기
            </Text>
            <Text style={{ color: colors.muted }}>
              {date} · 확정하기 전에는 저장하지 않아요.
            </Text>
            {status !== 'authenticated' ? (
              <Text accessibilityRole="alert">
                AI 일정 생성은 로그인 후 이용할 수 있어요.
              </Text>
            ) : (
              <>
                <Text>함께할 수 있는 시간대</Text>
                <TextInput
                  accessibilityLabel="가능 시간 시작"
                  value={start}
                  onChangeText={(value) => {
                    setStart(value);
                    setPreview(null);
                    setSelected([]);
                    setNotice('');
                  }}
                  editable={!busy && !uncertain}
                  placeholder="09:00"
                  maxLength={5}
                  style={inputStyle}
                />
                <TextInput
                  accessibilityLabel="가능 시간 종료"
                  value={end}
                  onChangeText={(value) => {
                    setEnd(value);
                    setPreview(null);
                    setSelected([]);
                    setNotice('');
                  }}
                  editable={!busy && !uncertain}
                  placeholder="18:00"
                  maxLength={5}
                  style={inputStyle}
                />
                <TextInput
                  accessibilityLabel="일정 생성 요청사항"
                  value={instructions}
                  onChangeText={(value) => {
                    setInstructions(value);
                    setPreview(null);
                    setSelected([]);
                    setNotice('');
                  }}
                  editable={!busy && !uncertain}
                  placeholder="예: 집에서 그림책을 보며 놀고 싶어요 (선택)"
                  multiline
                  maxLength={1000}
                  style={inputStyle}
                />
                <Text style={{ color: colors.muted }}>
                  저장한 아이 소개·고민·활동 시간을 참고해요. 소요 시간이 없는
                  기존 일정은 먼저 수정해주세요.
                </Text>
                <ActionButton
                  label={
                    busy === 'generate'
                      ? '일정 생성 중…'
                      : preview
                        ? '다시 생성하기'
                        : '일정 생성하기'
                  }
                  onPress={() => void generate()}
                  disabled={!!busy || uncertain}
                />
                {preview ? (
                  <>
                    <Text accessibilityRole="header">
                      저장할 후보를 골라주세요
                    </Text>
                    {!preview.candidates.length ? (
                      <Text>
                        시간대에 배치할 수 있는 후보가 없어요. 시간대를 바꿔
                        다시 생성할 수 있어요.
                      </Text>
                    ) : null}
                    {preview.candidates.map((c, i) => (
                      <Pressable
                        key={i}
                        accessibilityRole="checkbox"
                        accessibilityLabel={c.planName}
                        accessibilityState={{
                          checked: selected.includes(i),
                          disabled: !!busy || uncertain,
                        }}
                        aria-checked={selected.includes(i)}
                        disabled={!!busy || uncertain}
                        onPress={() =>
                          setSelected((s) =>
                            s.includes(i)
                              ? s.filter((n) => n !== i)
                              : [...s, i],
                          )
                        }
                        style={[
                          inputStyle,
                          {
                            backgroundColor: selected.includes(i)
                              ? colors.tint
                              : colors.surface,
                          },
                        ]}
                      >
                        <Text>
                          {selected.includes(i) ? '✓ ' : ''}
                          {c.scheduledTime.slice(0, 5)} · {c.planName} ·{' '}
                          {c.durationMinutes}분
                        </Text>
                        {c.content ? <Text>{c.content}</Text> : null}
                      </Pressable>
                    ))}
                    {preview.unscheduled.map((c, i) => (
                      <Text key={i} style={{ color: colors.muted }}>
                        배치 못한 활동: {c.planName} · {c.durationMinutes}분
                        (저장되지 않아요)
                      </Text>
                    ))}
                    <ActionButton
                      label={
                        busy === 'save' ? '저장 중…' : '선택한 일정 확정 저장'
                      }
                      onPress={() => void save()}
                      disabled={!!busy || uncertain || !selected.length}
                    />
                  </>
                ) : null}
                {notice ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {notice}
                  </Text>
                ) : null}
                {uncertain ? (
                  <ActionButton
                    label="저장 결과 목록 확인"
                    onPress={() => void inspect()}
                    disabled={!!busy}
                  />
                ) : null}
                {serverRows ? (
                  <View style={{ gap: 8 }}>
                    <Text accessibilityRole="header">현재 서버 일정</Text>
                    {serverRows.length ? (
                      serverRows.map((row) => (
                        <Text key={row.id}>
                          {row.scheduledTime.slice(0, 5)} · {row.planName}
                        </Text>
                      ))
                    ) : (
                      <Text>등록된 일정이 없어요.</Text>
                    )}
                    <Text>
                      결과를 확인한 뒤 창을 닫아주세요. 자동으로 다시 저장하지
                      않아요.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
            <ActionButton
              label={busy === 'generate' ? '생성 취소하고 닫기' : '닫기'}
              secondary
              disabled={busy === 'save'}
              onPress={() => {
                if (uncertain) onSaved();
                onClose();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
