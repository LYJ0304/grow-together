import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useAuth } from '../src/components/auth-provider';
import { BottomNavigation } from '../src/components/bottom-navigation';
import { ProfileEntry } from '../src/components/profile-entry';
import { ActionButton } from '../src/components/action-button';
import {
  DiaryResultView,
  DiaryGeneratingView,
} from '../src/components/diary/diary-result';
import { typography } from '../src/components/typography';
import { clearSessionValues, useSessionValue } from '../src/lib/session-state';
import {
  generateDiary,
  type DiaryGenerationResult,
  type DiarySourceRecords,
} from '../src/lib/diary-generation';
import {
  diaryDateKey,
  parseDiaryDate,
  readDiary,
  saveDiary,
  updateDiary,
  deleteDiary,
  type SavedDiary,
} from '../src/lib/diary-storage';
import { createTodoApi } from '../src/lib/features/todo/todoApi';
import { createDiaryApi } from '../src/lib/features/diary/diaryApi';
import { ApiError } from '../src/lib/api/errors';

export default function DiaryScreen() {
  const { date, mode, id } = useLocalSearchParams<{
    date?: string;
    mode?: string;
    id?: string;
  }>();
  return <DiaryEditor key={`${date}:${mode}:${id}`} />;
}

function DiaryEditor() {
  const params = useLocalSearchParams<{
    date?: string;
    mode?: string;
    id?: string;
  }>();
  const { client, status, epoch } = useAuth();
  const preview = status === 'preview';
  const queryClient = useQueryClient();
  const [date] = useState(() => parseDiaryDate(params.date) ?? new Date());
  const dateKey = diaryDateKey(date);
  const [, setCalendarDate] = useSessionValue('calendarDate', date);
  const [, setCalendarMonth] = useSessionValue(
    'calendarMonth',
    () => new Date(date.getFullYear(), date.getMonth(), 1),
  );
  useEffect(() => {
    setCalendarDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [date, setCalendarDate, setCalendarMonth]);
  const [knownIds, setKnownIds] = useSessionValue<Record<string, number>>(
    'diaryIds',
    {},
  );
  const id =
    params.id &&
    /^[1-9]\d*$/.test(params.id) &&
    Number.isSafeInteger(Number(params.id))
      ? Number(params.id)
      : knownIds[dateKey];
  const viewing = params.mode === 'view' || !!params.id || !!id;
  const prefix = `diary:${dateKey}:${viewing ? (id ?? 'preview') : 'new'}:`;
  const [step, setStep] = useSessionValue<'materials' | 'result'>(
    prefix + 'step',
    'materials',
  );
  const [selected, setSelected] = useSessionValue<number[]>(
    prefix + 'selected',
    [],
  );
  const [note, setNote] = useSessionValue(prefix + 'note', '');
  const [photos, setPhotos] = useSessionValue<string[]>(prefix + 'photos', []);
  const [draft, setDraft] = useSessionValue(prefix + 'body', '');
  const [editing, setEditing] = useSessionValue<string | null>(
    prefix + 'editing',
    null,
  );
  const [source, setSource] = useSessionValue<DiarySourceRecords | undefined>(
    prefix + 'source',
    undefined,
  );
  const [sourceIds, setSourceIds] = useSessionValue<number[]>(
    prefix + 'sourceIds',
    [],
  );
  const [result, setResult] = useSessionValue<DiaryGenerationResult | null>(
    prefix + 'result',
    null,
  );
  const [, setDirty] = useSessionValue(prefix + 'dirty', false);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'regenerate' | 'delete' | null>(null);
  const [completion, setCompletion] = useState<'saved' | 'deleted' | null>(
    null,
  );
  const saved = completion !== null;
  const [uncertain, setUncertain] = useSessionValue(
    prefix + 'uncertain',
    false,
  );
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const stillActive = () =>
    active.current && client.getSnapshot().epoch === epoch;
  usePreventRemove(busy || generating || preparing, () => {});
  useEffect(() => {
    if (completion && !busy && client.getSnapshot().epoch === epoch)
      router.dismissTo({
        pathname: '/calendar',
        params: {
          date: dateKey,
          saved: completion === 'saved' ? 'true' : '',
          deleted: completion === 'deleted' ? 'true' : '',
        },
      });
  }, [completion, busy, client, epoch, dateKey]);
  const api = createDiaryApi(client);
  const savedKey = [
    'savedDiary',
    preview ? 'preview' : epoch,
    preview ? dateKey : id,
  ];
  const savedQuery = useQuery({
    queryKey: savedKey,
    enabled: viewing && (preview || !!id),
    retry: false,
    queryFn: async () => {
      if (preview) return readDiary(dateKey);
      const diary = await api.getDiary(id!);
      return {
        date: dateKey,
        content: diary.content ?? '',
        photoUris: diary.diaryFiles.map((file) => file.imageUrl),
        emotions: [],
        growthPoints: [],
        sourceRecords: {
          activities: diary.todos.map((todo) => todo.planName),
          note: '',
          tags: [],
        },
      } satisfies SavedDiary;
    },
  });
  const todos = useQuery({
    queryKey: ['todos', dateKey],
    queryFn: () => createTodoApi(client).getTodos(dateKey),
    enabled: !viewing && status === 'authenticated',
    retry: false,
  });
  const completed = (todos.data ?? []).filter((todo) => todo.completed);
  const materials = completed.filter((todo) => selected.includes(todo.id));
  const dirty =
    !saved &&
    (viewing
      ? editing !== null && editing !== savedQuery.data?.content
      : !!draft ||
        !!editing ||
        !!note ||
        selected.length > 0 ||
        photos.length > 0);
  useEffect(() => setDirty(dirty), [dirty, setDirty]);
  useEffect(() => {
    if (!dirty || Platform.OS !== 'web') return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const back = () =>
    router.dismissTo({
      pathname: '/calendar',
      params: { date: dateKey, saved: '', deleted: '' },
    });
  const makeSource = (): DiarySourceRecords => ({
    activities: materials.map((todo) => todo.planName),
    note: note.trim(),
    tags: [],
  });
  const prepare = async (manual = false, replace = false) => {
    if (pending.current) return;
    if (
      !manual &&
      (draft.trim() || editing?.trim()) &&
      (!result || draft !== result.content || editing !== null) &&
      !replace
    ) {
      setConfirm('regenerate');
      return;
    }
    pending.current = true;
    setNotice('');
    const records = makeSource();
    try {
      if (!manual) setGenerating(true);
      const generated = manual
        ? { content: draft, emotions: [], growthPoints: [] }
        : await generateDiary(date, records);
      if (!stillActive()) return;
      setSource(records);
      setSourceIds(materials.map((todo) => todo.id));
      if (!manual) {
        setResult(generated);
        setDraft(generated.content);
        setEditing(null);
      } else setEditing(draft);
      setStep('result');
    } catch (error) {
      if (stillActive())
        setNotice(
          error instanceof Error
            ? error.message
            : '초안을 정리하지 못했어요. 직접 작성하거나 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (stillActive()) setGenerating(false);
    }
  };
  const persist = async () => {
    const content = viewing ? editing : draft;
    if (pending.current || !content?.trim() || uncertain) return;
    if (!preview && content.trim().length > 1000) {
      setNotice(
        '서버 일기 본문은 1000자 이내로 작성해주세요. 내용은 유지돼요.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      let savedId = id;
      if (preview) {
        if (viewing) await updateDiary(dateKey, content);
        else
          await saveDiary({
            date: dateKey,
            content: content.trim(),
            photoUris: photos,
            emotions: [],
            growthPoints: [],
            sourceRecords: source,
          });
      } else if (viewing) {
        // Keep image URLs and todo associations supplied by the server when editing the body.
        const original = await api.getDiary(id!);
        if (!stillActive()) return;
        await api.updateDiary(id!, {
          content: content.trim(),
          todoIds: original.todos.map((todo) => todo.id),
          diaryFiles: original.diaryFiles.map((file) => ({
            imageUrl: file.imageUrl,
          })),
        });
      } else {
        const created = await api.createDiary({
          content: content.trim(),
          todoIds: sourceIds,
          diaryFiles: [],
        });
        savedId = created.id;
      }
      if (!stillActive()) return;
      if (!preview && savedId)
        setKnownIds((current) => ({ ...current, [dateKey]: savedId! }));
      setCompletion('saved');
      clearSessionValues(prefix);
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      void queryClient.invalidateQueries({
        queryKey: ['savedDiaryDates', 'preview'],
      });
      void queryClient.invalidateQueries({ queryKey: ['diarySummary'] });
    } catch (error) {
      if (!stillActive()) return;
      const unknown =
        !preview &&
        !viewing &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500);
      setUncertain(unknown);
      setNotice(
        unknown
          ? '저장 여부를 확인하지 못했어요. 날짜별 서버 조회가 아직 없어 재시도하면 일기가 중복될 수 있어요.'
          : error instanceof Error
            ? error.message
            : '저장하지 못했어요. 작성 내용은 유지돼요. 다시 시도해주세요.',
      );
    } finally {
      pending.current = false;
      if (stillActive()) setBusy(false);
    }
  };
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (preview) await deleteDiary(dateKey);
      else await api.deleteDiary(id!);
      if (!stillActive()) return;
      setKnownIds((current) => {
        const next = { ...current };
        delete next[dateKey];
        return next;
      });
      setCompletion('deleted');
      clearSessionValues(prefix);
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      void queryClient.invalidateQueries({
        queryKey: ['savedDiaryDates', 'preview'],
      });
      void queryClient.invalidateQueries({ queryKey: ['diarySummary'] });
    } catch (error) {
      if (stillActive())
        setNotice(
          error instanceof Error
            ? error.message
            : '삭제하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (stillActive()) setBusy(false);
    }
  };
  const pickPhotos = async () => {
    if (preparing || pending.current) return;
    setPreparing(true);
    setNotice('');
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3,
        quality: 0.8,
      });
      if (selection.canceled) return;
      const encoded: string[] = [];
      for (const asset of selection.assets.slice(0, 3)) {
        const context = ImageManipulator.manipulate(asset.uri);
        try {
          const scale = Math.min(1, 960 / Math.max(asset.width, asset.height));
          context.resize({
            width: Math.max(1, Math.round(asset.width * scale)),
            height: Math.max(1, Math.round(asset.height * scale)),
          });
          const image = await context.renderAsync();
          try {
            const output = await image.saveAsync({
              format: SaveFormat.JPEG,
              compress: 0.6,
              base64: true,
            });
            if (!output.base64) throw new Error('사진 변환 실패');
            encoded.push(`data:image/jpeg;base64,${output.base64}`);
          } finally {
            image.release();
          }
        } finally {
          context.release();
          if (Platform.OS === 'web') URL.revokeObjectURL(asset.uri);
        }
      }
      if (stillActive()) setPhotos(encoded);
    } catch {
      if (stillActive())
        setNotice('사진을 선택하지 못했어요. 다시 시도해주세요.');
    } finally {
      if (stillActive()) setPreparing(false);
    }
  };
  const display = viewing ? (savedQuery.data?.content ?? '') : draft;
  const unavailable = viewing && !preview && !id;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ProfileEntry disabled={busy || generating || preparing} />
          <ActionButton
            label="기록으로 돌아가기"
            secondary
            disabled={busy || generating || preparing}
            onPress={back}
          />
          <Text style={styles.meta}>
            {viewing && !params.date && !knownIds[dateKey]
              ? '날짜 정보 미지원'
              : dateKey}{' '}
            ·{' '}
            {viewing
              ? '저장된 일기'
              : step === 'materials'
                ? '1. 오늘의 재료 확인'
                : '3. 수정하고 저장'}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {viewing ? '육아 일기' : '오늘의 순간을 남겨요'}
          </Text>
          <Text style={styles.meta}>
            {preview
              ? '미리보기 · 이 기기에만 저장돼요. 과거 소유자 미확인 기록은 별도로 보존돼 있어요.'
              : '초안은 이 로그인 세션에서 유지돼요. 앱을 종료하면 저장하지 않은 내용은 사라져요.'}
          </Text>
          {unavailable ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                날짜로 서버 일기를 찾는 기능은 연결 준비 중이에요. 일기 ID가
                있는 링크로 조회할 수 있어요.
              </Text>
            </View>
          ) : viewing && !savedQuery.data ? (
            <View style={styles.card}>
              <Text
                accessibilityRole={savedQuery.isError ? 'alert' : undefined}
                style={styles.body}
              >
                {savedQuery.isError
                  ? '일기를 불러오지 못했어요.'
                  : savedQuery.isPending
                    ? '일기를 불러오고 있어요.'
                    : '저장된 일기가 없어요.'}
              </Text>
              {savedQuery.isError ? (
                <ActionButton
                  label="일기 다시 불러오기"
                  onPress={() => void savedQuery.refetch()}
                />
              ) : null}
            </View>
          ) : generating ? (
            <>
              <Text style={styles.meta}>
                2. 초안 만들기 · 입력한 기록 정리 중
              </Text>
              <DiaryGeneratingView />
            </>
          ) : !viewing && step === 'materials' ? (
            <>
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.section}>
                  함께한 활동 선택
                </Text>
                {preview ? (
                  <Text style={styles.body}>
                    미리보기에서는 실제 활동을 불러오지 않아요. 관찰 메모로
                    시작해보세요.
                  </Text>
                ) : todos.isPending ? (
                  <Text style={styles.body}>활동을 불러오고 있어요.</Text>
                ) : todos.isError ? (
                  <>
                    <Text accessibilityRole="alert" style={styles.body}>
                      활동을 불러오지 못했어요. 메모만으로 직접 작성할 수도
                      있어요.
                    </Text>
                    <ActionButton
                      label="활동 다시 불러오기"
                      secondary
                      onPress={() => void todos.refetch()}
                    />
                  </>
                ) : completed.length === 0 ? (
                  <Text style={styles.body}>
                    완료한 일정이 없어요. 메모만으로 작성해도 괜찮아요.
                  </Text>
                ) : (
                  completed.map((todo) => (
                    <Pressable
                      key={todo.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${todo.scheduledTime.slice(0, 5)} ${todo.planName}`}
                      accessibilityState={{
                        checked: selected.includes(todo.id),
                      }}
                      onPress={() =>
                        setSelected((current) =>
                          current.includes(todo.id)
                            ? current.filter((value) => value !== todo.id)
                            : [...current, todo.id],
                        )
                      }
                      style={styles.record}
                    >
                      <Text style={styles.body}>
                        {selected.includes(todo.id) ? '☑' : '☐'}{' '}
                        {todo.scheduledTime.slice(0, 5)} · {todo.planName}
                      </Text>
                      {todo.content ? (
                        <Text style={styles.meta}>
                          일정 메모: {todo.content}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
                <Text style={styles.meta}>
                  선택한 완료 활동만 일기에 포함돼요. 일정 메모는 계획일 수도
                  있으니 실제 관찰은 아래에 직접 적어주세요.
                </Text>
              </View>
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.section}>
                  관찰 메모 (선택)
                </Text>
                <TextInput
                  accessibilityLabel="추가 관찰 메모"
                  placeholder="함께한 상황과 아이의 반응을 적어주세요"
                  placeholderTextColor="#706A67"
                  multiline
                  maxLength={1000}
                  value={note}
                  onChangeText={setNote}
                  style={styles.input}
                  textAlignVertical="top"
                />
                <Text style={styles.meta}>
                  아이의 반응과 보호자의 감정을 구분해 적어주세요.
                </Text>
                {preview ? (
                  <>
                    <ActionButton
                      label={
                        preparing
                          ? '사진 준비 중…'
                          : photos.length
                            ? '첨부 사진 변경'
                            : '사진 첨부'
                      }
                      secondary
                      disabled={preparing}
                      onPress={() => void pickPhotos()}
                    />
                    {photos.length ? (
                      <>
                        <Text style={styles.meta}>
                          사진 {photos.length}장 · 미리보기 기기 저장 전용
                        </Text>
                        <ActionButton
                          label="첨부 사진 삭제"
                          secondary
                          onPress={() => setPhotos([])}
                        />
                      </>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.meta}>
                    사진 업로드와 활동별 반응 저장은 연결 준비 중이에요.
                  </Text>
                )}
              </View>
              <Text style={styles.meta}>
                2. 초안 만들기 · 실제 AI 연결 없이 선택한 활동과 메모를 문장으로
                정리해요.
              </Text>
              <ActionButton
                label="입력한 기록으로 초안 정리"
                disabled={preparing}
                onPress={() => void prepare()}
              />
              <ActionButton
                label="직접 작성하기"
                secondary
                disabled={preparing}
                onPress={() => void prepare(true)}
              />
            </>
          ) : (
            <>
              <DiaryResultView
                result={{
                  ...(result ?? { emotions: [], growthPoints: [] }),
                  content: display,
                }}
                photos={viewing ? (savedQuery.data?.photoUris ?? []) : photos}
                source={viewing ? savedQuery.data?.sourceRecords : source}
                editingText={editing}
                persisted={viewing}
                busy={busy}
                onChangeText={setEditing}
                onEdit={() => setEditing(display)}
                onCancel={() => setEditing(null)}
                onComplete={() => {
                  if (viewing) void persist();
                  else if (editing?.trim()) {
                    setDraft(editing.trim());
                    setEditing(null);
                  }
                }}
              />
              {editing === null ? (
                !viewing ? (
                  <>
                    <ActionButton
                      label={busy ? '저장 중…' : '이 일기 저장하기'}
                      disabled={busy || !draft.trim() || uncertain}
                      onPress={() => void persist()}
                    />
                    {!preview ? (
                      <Text style={styles.meta}>
                        본문과 선택한 활동을 서버에 저장해요. 날짜 정보·관찰
                        메모 원본·초안 재료는 서버 일기 계약에 별도로 저장되지
                        않아요.
                      </Text>
                    ) : null}
                    <ActionButton
                      label="재료 다시 확인"
                      secondary
                      disabled={busy}
                      onPress={() => setStep('materials')}
                    />
                    <ActionButton
                      label="초안 다시 정리"
                      secondary
                      disabled={busy}
                      onPress={() => void prepare()}
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      label="일기 삭제"
                      secondary
                      disabled={busy}
                      onPress={() => setConfirm('delete')}
                    />
                  </>
                )
              ) : null}
            </>
          )}
          {notice ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notice}
            </Text>
          ) : null}
          {uncertain ? (
            <ActionButton
              label="중복 가능성을 확인하고 다시 저장"
              secondary
              onPress={() => {
                setUncertain(false);
                setNotice(
                  '본문은 유지됐어요. 저장 여부를 확인한 후 다시 저장해주세요.',
                );
              }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavigation
        disabled={busy || generating || preparing}
        active="기록"
        onReselect={back}
      />
      {confirm !== null ? (
        <Modal
          transparent
          visible
          onRequestClose={() => {
            if (!pending.current) setConfirm(null);
          }}
          animationType="fade"
        >
          <SafeAreaView style={styles.overlay}>
            <ScrollView
              style={{
                maxHeight: '90%',
                width: '100%',
                maxWidth: 560,
                alignSelf: 'center',
              }}
              contentContainerStyle={styles.card}
              accessibilityViewIsModal
            >
              <Text accessibilityRole="header" style={styles.title}>
                {confirm === 'delete'
                  ? '일기를 삭제할까요?'
                  : '수정한 본문을 새 초안으로 바꿀까요?'}
              </Text>
              <Text style={styles.body}>
                {confirm === 'delete'
                  ? '삭제한 일기는 복구할 수 없어요.'
                  : '취소하면 수정한 본문이 유지돼요. 새 초안은 선택한 활동과 메모로 정리돼요.'}
              </Text>
              {notice ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {notice}
                </Text>
              ) : null}
              <ActionButton
                label="취소"
                secondary
                disabled={busy}
                onPress={() => setConfirm(null)}
              />
              <ActionButton
                label={
                  busy
                    ? '처리 중…'
                    : confirm === 'delete'
                      ? '삭제'
                      : '교체하고 다시 정리'
                }
                disabled={busy}
                onPress={() => {
                  if (confirm === 'delete') void remove();
                  else {
                    setConfirm(null);
                    void prepare(false, true);
                  }
                }}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 14 },
  title: { ...typography.title, color: '#433C39' },
  section: { ...typography.section, color: '#433C39' },
  body: { ...typography.body, color: '#494442' },
  meta: { ...typography.caption, color: '#625B57' },
  error: { ...typography.body, color: '#A03C30' },
  input: {
    ...typography.body,
    color: '#433C39',
    minHeight: 130,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D3C4BC',
    borderRadius: 12,
    backgroundColor: '#FAF9F9',
  },
  record: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9D2C8',
    borderRadius: 12,
    gap: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
});
