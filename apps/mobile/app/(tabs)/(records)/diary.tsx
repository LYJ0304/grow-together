import { editorial } from '../../../src/theme/editorial';
import { colors } from '../../../src/theme/colors';
import { useChatKeyboard } from '../../../src/lib/use-chat-keyboard';
import { useTabInteraction } from '../../../src/components/tab-interaction';
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
import { useAuth } from '../../../src/components/auth-provider';
import { AppHeader, HeaderTools } from '../../../src/components/app-header';
import { DiaryPhotos } from '../../../src/components/diary/diary-photos';
import { ActionButton } from '../../../src/components/action-button';
import {
  DiaryResultView,
  DiaryGeneratingView,
} from '../../../src/components/diary/diary-result';
import { typography } from '../../../src/components/typography';
import {
  clearSessionValues,
  useSessionValue,
} from '../../../src/lib/session-state';
import {
  generateDiary,
  type DiaryGenerationResult,
  type DiarySourceRecords,
} from '../../../src/lib/diary-generation';
import {
  diaryDateKey,
  parseDiaryDate,
  readDiary,
  saveDiary,
  updateDiary,
  deleteDiary,
  type SavedDiary,
} from '../../../src/lib/diary-storage';
import { createTodoApi } from '../../../src/lib/features/todo/todoApi';
import { createDiaryApi } from '../../../src/lib/features/diary/diaryApi';
import { ApiError } from '../../../src/lib/api/errors';

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
  const dateLookup = useQuery({
    queryKey: ['diaryByDate', epoch, dateKey],
    enabled: status === 'authenticated' && !params.id,
    retry: false,
    queryFn: async () => {
      try {
        return await createDiaryApi(client).getByDate(dateKey);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const id =
    params.id &&
    /^[1-9]\d*$/.test(params.id) &&
    Number.isSafeInteger(Number(params.id))
      ? Number(params.id)
      : dateLookup.data?.id;
  const viewing = params.mode === 'view' || !!params.id || !!id;
  const prefix = `diary:${dateKey}:${viewing ? (id ?? 'preview') : 'new'}:`;
  const [bodyHeight, setBodyHeight] = useState(190);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selected, setSelected] = useSessionValue<number[]>(
    prefix + 'selected',
    [],
  );
  const [note] = useSessionValue(prefix + 'note', '');
  const [photos, setPhotos] = useSessionValue<string[]>(prefix + 'photos', []);
  const [draft, setDraft] = useSessionValue(prefix + 'body', note);
  const [editing, setEditing] = useSessionValue<string | null>(
    prefix + 'editing',
    null,
  );
  const [source, setSource] = useSessionValue<DiarySourceRecords | undefined>(
    prefix + 'source',
    undefined,
  );
  const [result, setResult] = useSessionValue<DiaryGenerationResult | null>(
    prefix + 'result',
    null,
  );
  const [, setDirty] = useSessionValue(prefix + 'dirty', false);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [conflict, setConflict] = useState(false);
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
  const keyboard = useChatKeyboard();
  useTabInteraction(busy || generating || preparing, keyboard.visible);
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
      ? editing !== null &&
        (editing !== savedQuery.data?.content ||
          JSON.stringify(photos) !== JSON.stringify(savedQuery.data?.photoUris))
      : !!draft || !!editing || selected.length > 0 || photos.length > 0);
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
    note: (viewing ? (editing ?? '') : draft).trim(),
    tags: [],
  });
  const prepare = async (replace = false) => {
    if (pending.current) return;
    if ((draft.trim() || editing?.trim()) && !replace) {
      setConfirm('regenerate');
      return;
    }
    pending.current = true;
    setNotice('');
    const records = makeSource();
    try {
      setGenerating(true);
      const generated = await generateDiary(date, records);
      if (!stillActive()) return;
      setSource(records);

      setResult(generated);
      setDraft(generated.content);
      setEditing(null);
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
      if (preview) {
        if (viewing) await updateDiary(dateKey, content, photos);
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
        const existingUrls = new Set(
          original.diaryFiles.map((file) => file.imageUrl),
        );
        await api.updateDiary(id!, {
          content: content.trim(),
          todoIds: original.todos.map((todo) => todo.id),
          diaryFiles: photos
            .filter((uri) => existingUrls.has(uri))
            .map((imageUrl) => ({ imageUrl })),
        });
      } else {
        await api.createDiary({
          diaryDate: dateKey,
          content: content.trim(),
          todoIds: materials.map((todo) => todo.id),
          diaryFiles: [],
        });
      }
      if (!stillActive()) return;

      setCompletion('saved');
      clearSessionValues(prefix);
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      void queryClient.invalidateQueries({
        queryKey: ['savedDiaryDates'],
      });
      void queryClient.invalidateQueries({ queryKey: ['diarySummary'] });
      void queryClient.invalidateQueries({ queryKey: ['diaryByDate'] });
    } catch (error) {
      if (!stillActive()) return;
      const unknown =
        !preview &&
        !viewing &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500);
      setUncertain(unknown);
      const duplicate = error instanceof ApiError && error.status === 409;
      setConflict(duplicate);
      setNotice(
        duplicate
          ? '이미 일기가 있거나 다른 일기에 연결된 활동이에요. 입력 내용은 유지돼요. 기존 일기를 확인해주세요.'
          : unknown
            ? '저장 여부를 확인하지 못했어요. 입력 내용은 유지돼요. 기존 일기를 확인한 뒤 다시 시도해주세요.'
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

      setCompletion('deleted');
      clearSessionValues(prefix);
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      void queryClient.invalidateQueries({
        queryKey: ['savedDiaryDates'],
      });
      void queryClient.invalidateQueries({ queryKey: ['diarySummary'] });
      void queryClient.invalidateQueries({ queryKey: ['diaryByDate'] });
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
    if (preparing || pending.current || !preview || photos.length >= 3) return;
    pending.current = true;
    setPreparing(true);
    setNotice('');
    let selectedUris: string[] = [];
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3 - photos.length,
        quality: 0.8,
      });
      if (selection.canceled) return;
      selectedUris = selection.assets.map((asset) => asset.uri);
      const encoded: string[] = [];
      for (const asset of selection.assets.slice(0, 3)) {
        if (
          (asset.mimeType &&
            !/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(asset.mimeType)) ||
          (asset.fileSize ?? 0) > 10 * 1024 * 1024
        ) {
          throw new Error(
            'JPEG, PNG, WebP, HEIC 형식의 10MB 이하 사진을 선택해주세요.',
          );
        }
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
        }
      }
      if (stillActive()) {
        const combined = [...new Set([...photos, ...encoded])];
        setPhotos(combined.slice(0, 3));
        if (combined.length > 3)
          setNotice('사진은 최대 3장까지 첨부할 수 있어요.');
      }
    } catch (error) {
      if (stillActive())
        setNotice(
          error instanceof Error
            ? error.message
            : '사진을 선택하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (Platform.OS === 'web')
        selectedUris.forEach((uri) => URL.revokeObjectURL(uri));
      if (stillActive()) setPreparing(false);
    }
  };
  const display = viewing ? (savedQuery.data?.content ?? '') : draft;
  const unavailable = viewing && !preview && !id;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.screen,
        keyboard.viewport && {
          flex: 0,
          height: keyboard.viewport.height,
          transform: [{ translateY: keyboard.viewport.offsetTop }],
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <AppHeader
          disabled={busy || generating || preparing}
          onBack={back}
          backLabel="기록으로 돌아가기"
          rightActions={
            <HeaderTools disabled={busy || generating || preparing} />
          }
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.meta}>
            {date.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {viewing ? '하루의 일기' : '오늘의 일기'}
          </Text>
          <Text style={styles.meta}>
            {preview
              ? '미리보기 · 이 기기에만 저장돼요.'
              : '저장 전 내용은 이 로그인 세션에서 유지돼요.'}
          </Text>
          {!preview &&
          !params.id &&
          (dateLookup.isPending || dateLookup.isError) ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                {dateLookup.isError
                  ? '날짜의 일기를 확인하지 못했어요.'
                  : '저장된 일기를 확인하고 있어요.'}
              </Text>
              {dateLookup.isError ? (
                <ActionButton
                  label="일기 다시 확인하기"
                  variant="secondary"
                  onPress={() => void dateLookup.refetch()}
                />
              ) : null}
            </View>
          ) : unavailable ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                해당 날짜에 저장된 일기가 없어요. 일기 ID가 있는 링크로 조회할
                수 있어요.
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
                  variant="secondary"
                  onPress={() => void savedQuery.refetch()}
                />
              ) : null}
            </View>
          ) : (
            <>
              {viewing && editing === null ? (
                <DiaryResultView
                  result={{
                    ...(result ?? { emotions: [], growthPoints: [] }),
                    content: display,
                  }}
                  source={savedQuery.data?.sourceRecords}
                  busy={busy}
                  onEdit={() => {
                    setPhotos(savedQuery.data?.photoUris ?? []);
                    setEditing(display);
                  }}
                />
              ) : (
                <View style={{ gap: 8 }}>
                  <TextInput
                    accessibilityLabel={
                      viewing ? '일기 본문 수정' : '일기 본문'
                    }
                    placeholder="함께한 순간을 글과 사진으로 남겨요."
                    placeholderTextColor={colors.muted}
                    multiline
                    editable={!busy && !generating && !preparing}
                    value={viewing ? (editing ?? '') : draft}
                    onChangeText={viewing ? setEditing : setDraft}
                    textAlignVertical="top"
                    selectionColor={colors.primary}
                    onContentSizeChange={(event) =>
                      setBodyHeight(event.nativeEvent.contentSize.height)
                    }
                    style={[
                      styles.input,
                      { height: Math.max(190, bodyHeight) },
                    ]}
                  />
                  <Text style={styles.meta}>
                    {(viewing ? (editing ?? '') : draft).length} /{' '}
                    {preview ? '미리보기' : '1000자'}
                  </Text>
                </View>
              )}
              <DiaryPhotos
                photos={
                  viewing && editing === null
                    ? (savedQuery.data?.photoUris ?? [])
                    : photos
                }
                editable={!viewing || editing !== null}
                canAdd={preview}
                busy={busy || preparing || generating}
                onAdd={() => void pickPhotos()}
                onRemove={(index) =>
                  setPhotos((current) => current.filter((_, i) => i !== index))
                }
              />
              {!viewing ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="함께한 활동 선택"
                    accessibilityState={{ expanded: activitiesOpen }}
                    onPress={() => setActivitiesOpen(!activitiesOpen)}
                    style={styles.disclosure}
                  >
                    <Text style={styles.section}>함께한 활동</Text>
                    <Text style={styles.meta}>
                      {selected.length}개 선택 ·{' '}
                      {activitiesOpen ? '접기' : '펼치기'}
                    </Text>
                  </Pressable>
                  {activitiesOpen ? (
                    <View style={{ gap: 10 }}>
                      {preview ? (
                        <Text style={styles.meta}>
                          미리보기에서는 실제 활동을 불러오지 않아요. 본문만으로
                          작성해도 괜찮아요.
                        </Text>
                      ) : todos.isPending ? (
                        <Text style={styles.meta}>활동을 불러오고 있어요.</Text>
                      ) : todos.isError ? (
                        <>
                          <Text accessibilityRole="alert" style={styles.error}>
                            활동을 불러오지 못했어요. 본문은 계속 작성할 수
                            있어요.
                          </Text>
                          <ActionButton
                            label="활동 다시 불러오기"
                            variant="secondary"
                            onPress={() => void todos.refetch()}
                          />
                        </>
                      ) : !completed.length ? (
                        <Text style={styles.meta}>
                          완료한 일정이 없어요. 본문만으로 작성해도 괜찮아요.
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
                            disabled={busy || generating}
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
                        완료한 활동만 선택해요. 일정 메모는 계획일 수 있으니
                        실제 관찰은 본문에 적어주세요.
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="문장 정리"
                    accessibilityState={{ expanded: helpOpen }}
                    onPress={() => setHelpOpen(!helpOpen)}
                    style={styles.disclosure}
                  >
                    <Text style={styles.section}>글쓰기 도움</Text>
                    <Text style={styles.meta}>
                      {helpOpen ? '접기' : '문장 정리'}
                    </Text>
                  </Pressable>
                  {helpOpen ? (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.meta}>
                        실제 AI 호출 없이 본문과 선택한 활동을 문장으로
                        정리해요. 기존 본문을 바꾸기 전에 확인해요.
                      </Text>
                      <ActionButton
                        label="입력한 기록으로 문장 정리"
                        variant="secondary"
                        disabled={busy || generating || preparing}
                        onPress={() => void prepare()}
                      />
                    </View>
                  ) : null}
                  {generating ? <DiaryGeneratingView /> : null}
                </>
              ) : null}
              {!viewing || editing !== null ? (
                <>
                  <ActionButton
                    label={
                      busy
                        ? '저장 중…'
                        : viewing
                          ? '변경사항 저장'
                          : '일기 저장하기'
                    }
                    variant="primary"
                    disabled={
                      busy ||
                      generating ||
                      preparing ||
                      !(viewing ? editing : draft)?.trim() ||
                      uncertain
                    }
                    onPress={() => void persist()}
                  />
                  {viewing ? (
                    <ActionButton
                      label="취소"
                      variant="tertiary"
                      disabled={busy}
                      onPress={() => {
                        setEditing(null);
                        setPhotos([]);
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <ActionButton
                  label="일기 삭제"
                  variant="destructive"
                  disabled={busy}
                  onPress={() => setConfirm('delete')}
                />
              )}
            </>
          )}
          {conflict || uncertain ? (
            <ActionButton
              label="기존 일기 확인"
              variant="secondary"
              onPress={async () => {
                try {
                  const existing = await api.getByDate(dateKey);
                  if (stillActive())
                    router.push({
                      pathname: '/diary',
                      params: {
                        date: dateKey,
                        mode: 'view',
                        id: String(existing.id),
                      },
                    });
                } catch (error) {
                  if (stillActive())
                    setNotice(
                      error instanceof ApiError && error.status === 404
                        ? '이 날짜의 일기는 아직 없어요. 작성 내용은 유지돼요.'
                        : '기존 일기를 확인하지 못했어요. 다시 시도해주세요.',
                    );
                }
              }}
            />
          ) : null}
          {notice ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notice}
            </Text>
          ) : null}
          {uncertain ? (
            <ActionButton
              label="중복 가능성을 확인하고 다시 저장"
              variant="secondary"
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
                variant="tertiary"
                disabled={busy}
                onPress={() => setConfirm(null)}
              />
              <ActionButton
                variant={
                  confirm === 'delete' ? 'destructive-confirm' : 'primary'
                }
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
                    void prepare(true);
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  card: {
    ...editorial.card,
    gap: 14,
  },
  title: { ...typography.title, color: colors.text },
  section: { ...typography.section, color: colors.text },
  body: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.muted },
  error: { ...typography.body, color: colors.danger },
  input: {
    outlineColor: colors.primary,
    ...typography.body,
    color: colors.text,
    minHeight: 190,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  disclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  record: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
});
