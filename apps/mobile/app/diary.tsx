import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteDiary,
  diaryDateKey,
  parseDiaryDate,
  readDiary,
  saveDiary,
} from '../src/lib/diary-storage';

import {
  DiaryGeneratingView,
  DiaryResultView,
} from '../src/components/diary/diary-result';
import {
  generateDiary,
  type DiaryGenerationResult,
  type DiarySourceRecords,
} from '../src/lib/diary-generation';

const activityOptions = [
  {
    time: '07:00',
    title: '기상 & 기저귀 갈기',
  },
  {
    time: '07:30',
    title: '아침 이유식',
  },
  {
    time: '09:00',
    title: '놀이 & 탐색',
  },
  {
    time: '10:00',
    title: '낮잠 (1~1.5시간)',
  },
  {
    time: '12:30',
    title: '산책 & 외부 활동',
  },
  {
    time: '14:00',
    title: '책 읽기 & 놀이',
  },
  {
    time: '15:00',
    title: '낮잠 (1시간)',
  },
  {
    time: '17:30',
    title: '산책 / 외부 활동',
  },
  {
    time: '18:00',
    title: '저녁 이유식',
  },
  {
    time: '19:30',
    title: '책 읽기 & 차분한 놀이',
  },
  {
    time: '20:00',
    title: '취침 준비',
  },
  {
    time: '21:00',
    title: '취침',
  },
];
const growthTags = ['#성취/시도', '#언어/표현', '#감정'];
type DiaryStep = 'activities' | 'notes' | 'generating' | 'result' | 'saved';

export default function DiaryScreen() {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const { date: dateParam, mode } = useLocalSearchParams<{
    date?: string;
    mode?: string;
  }>();
  const queryClient = useQueryClient();
  const viewing = mode === 'view';
  const [date] = useState(() => parseDiaryDate(dateParam) ?? new Date());
  const dateKey = diaryDateKey(date);
  const [step, setStep] = useState<DiaryStep>(viewing ? 'saved' : 'activities');
  const savedQuery = useQuery({
    queryKey: ['savedDiary', dateKey],
    queryFn: () => readDiary(dateKey),
    enabled: viewing,
    retry: false,
  });
  const [selectedRecordTimes, setSelectedRecordTimes] = useState<string[]>([]);
  const selectedRecords = activityOptions.filter((record) =>
    selectedRecordTimes.includes(record.time),
  );
  const [growthNote, setGrowthNote] = useState('');
  const [selectedGrowthTags, setSelectedGrowthTags] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const photoUri = photoUris[0] ?? null;
  const [photoNotice, setPhotoNotice] = useState('');
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [result, setResult] = useState<DiaryGenerationResult | null>(null);
  const [sourceRecords, setSourceRecords] = useState<DiarySourceRecords>();
  const [draft, setDraft] = useState('');
  const [editingText, setEditingText] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const generatingRef = useRef(false);
  const savingRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const [regenerationsRemaining, setRegenerationsRemaining] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState('');
  const deletingRef = useRef(false);
  const dirty =
    !viewing &&
    !saved &&
    (selectedRecordTimes.length > 0 ||
      !!growthNote.trim() ||
      selectedGrowthTags.length > 0 ||
      photoUris.length > 0 ||
      !!draft);
  usePreventRemove(dirty || saving || deleting, ({ data }) => {
    if (savingRef.current || deletingRef.current) return;
    setLeaveAction(() => () => navigation.dispatch(data.action));
  });

  useEffect(() => {
    if (!deleted || deleting) return;
    router.dismissTo({
      pathname: '/calendar',
      params: { date: dateKey, deleted: 'true', saved: '' },
    });
  }, [deleted, deleting, dateKey]);

  useEffect(() => {
    if ((!deleting && !saving && !dirty) || Platform.OS !== 'web') return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    // Block traversal before Expo Router receives a popstate and changes its history.
    const webNavigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const preventNavigation = (event: Event) => event.preventDefault();
    if (deleting || saving)
      webNavigation?.addEventListener('navigate', preventNavigation);
    window.addEventListener('beforeunload', preventUnload);
    return () => {
      webNavigation?.removeEventListener('navigate', preventNavigation);
      window.removeEventListener('beforeunload', preventUnload);
    };
  }, [deleting, saving, dirty]);

  const removeDiary = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteNotice('');
    try {
      await deleteDiary(dateKey);
      await queryClient.cancelQueries({ queryKey: ['savedDiary', dateKey] });
      await queryClient.cancelQueries({ queryKey: ['savedDiaryDates'] });
      queryClient.setQueryData(['savedDiary', dateKey], null);
      queryClient.setQueryData<string[]>(['savedDiaryDates'], (dates) =>
        dates?.filter((date) => date !== dateKey),
      );
      void queryClient.invalidateQueries({ queryKey: ['savedDiaryDates'] });
      setDeleted(true);
    } catch (error) {
      setDeleteNotice(
        error instanceof Error
          ? error.message
          : '일기를 삭제하지 못했어요. 다시 시도해주세요.',
      );
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };
  const displayedDraft = viewing ? (savedQuery.data?.content ?? '') : draft;
  const displayedPhotos = viewing
    ? (savedQuery.data?.photoUris ?? [])
    : photoUris;
  const emotions = viewing
    ? (savedQuery.data?.emotions ?? [])
    : (result?.emotions ?? []);
  const growthPoints = viewing
    ? (savedQuery.data?.growthPoints ?? [])
    : (result?.growthPoints ?? []);

  const returnToCalendar = (saved = false) =>
    router.dismissTo({
      pathname: '/calendar',
      params: { date: dateKey, saved: saved ? 'true' : '', deleted: '' },
    });

  const goBack = () => {
    if (savingRef.current || deletingRef.current) return;
    Keyboard.dismiss();
    if (viewing) returnToCalendar();
    else if (editingText !== null)
      setSaveNotice('수정을 완료하거나 취소한 후 이동해주세요.');
    else if (step === 'generating') return;
    else if (step === 'result') setStep('notes');
    else if (step === 'notes') setStep('activities');
    else if (router.canGoBack()) router.back();
    else returnToCalendar();
  };

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로가기"
      disabled={saving || deleting || step === 'generating'}
      onPress={goBack}
      style={({ pressed }) => [
        styles.backButton,
        (pressed || saving || deleting) && styles.pressed,
      ]}
    >
      <Text style={styles.backIcon}>‹</Text>
    </Pressable>
  );

  const persistDiary = async () => {
    if (
      savingRef.current ||
      saved ||
      generatingRef.current ||
      editingText !== null ||
      !draft.trim()
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveNotice('');
    try {
      const diary = {
        date: dateKey,
        content: draft.trim(),
        emotions,
        growthPoints,
        tomorrowTip: result?.tomorrowTip,
        sourceRecords,
        photoUris,
      };
      await saveDiary(diary);
      queryClient.setQueryData(['savedDiary', dateKey], diary);
      void queryClient.invalidateQueries({ queryKey: ['savedDiaryDates'] });
      setSaved(true);
    } catch (error) {
      setSaveNotice(
        error instanceof Error
          ? error.message
          : '일기를 저장하지 못했어요. 다시 시도해주세요.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (saved && !saving) {
      router.dismissTo({
        pathname: '/calendar',
        params: { date: dateKey, saved: 'true', deleted: '' },
      });
    }
  }, [saved, saving, dateKey]);

  const createPreview = async (regenerate = false) => {
    if (
      generatingRef.current ||
      savingRef.current ||
      (result && regenerationsRemaining === 0)
    )
      return;
    if (
      result &&
      (draft !== result.content || editingText !== null) &&
      !regenerate
    ) {
      setConfirmRegenerate(true);
      return;
    }
    generatingRef.current = true;
    const previousStep = step;
    const source = {
      activities: selectedRecords.map((record) => record.title),
      note: growthNote.trim(),
      tags: [...selectedGrowthTags],
    };
    Keyboard.dismiss();
    setSaveNotice('');
    setStep('generating');
    try {
      const generated = await generateDiary(date, source);
      setResult(generated);
      setSourceRecords(source);
      setDraft(generated.content);
      setEditingText(null);
      if (result) setRegenerationsRemaining((remaining) => remaining - 1);
      setStep('result');
    } catch (error) {
      setSaveNotice(
        error instanceof Error
          ? error.message
          : '일기를 만들지 못했어요. 다시 시도해주세요.',
      );
      setStep(previousStep);
    } finally {
      generatingRef.current = false;
    }
  };

  const requestRegeneration = () => {
    if (
      generatingRef.current ||
      savingRef.current ||
      regenerationsRemaining === 0
    )
      return;
    if (result && (draft !== result.content || editingText !== null))
      setConfirmRegenerate(true);
    else void createPreview(true);
  };

  const toggleRecord = (time: string) => {
    setSelectedRecordTimes((current) =>
      current.includes(time)
        ? current.filter((item) => item !== time)
        : [...current, time],
    );
  };

  const toggleGrowthTag = (tag: string) => {
    setSelectedGrowthTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const selectPhoto = async () => {
    setPhotoNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3,
        quality: 0.8,
      });
      if (!result.canceled) {
        setPreparingPhotos(true);
        try {
          const photos: string[] = [];
          for (const asset of result.assets.slice(0, 3)) {
            const context = ImageManipulator.manipulate(asset.uri);
            try {
              const scale = Math.min(
                1,
                960 / Math.max(asset.width, asset.height),
              );
              context.resize({
                width: Math.max(1, Math.round(asset.width * scale)),
                height: Math.max(1, Math.round(asset.height * scale)),
              });
              const image = await context.renderAsync();
              try {
                const encoded = await image.saveAsync({
                  format: SaveFormat.JPEG,
                  compress: 0.6,
                  base64: true,
                });
                if (!encoded.base64) throw new Error('Missing image data');
                photos.push(`data:image/jpeg;base64,${encoded.base64}`);
              } finally {
                image.release();
              }
            } finally {
              context.release();
            }
          }
          setPhotoUris(photos);
        } finally {
          setPreparingPhotos(false);
          if (Platform.OS === 'web')
            result.assets.forEach((asset) => URL.revokeObjectURL(asset.uri));
        }
      }
    } catch {
      setPhotoNotice('사진을 선택하지 못했어요. 다시 시도해주세요.');
    }
  };

  if (!hydrated || (viewing && !savedQuery.data)) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.recordHeader}>{backButton}</View>
        <View style={styles.readStatus}>
          <Text accessibilityLiveRegion="polite" style={styles.readStatusText}>
            {!hydrated || savedQuery.isPending
              ? '저장된 일기를 불러오는 중이에요.'
              : savedQuery.error instanceof Error
                ? savedQuery.error.message
                : '이 날짜에 저장된 일기가 없어요.'}
          </Text>
          {savedQuery.isError ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => savedQuery.refetch()}
              style={styles.readStatusButton}
            >
              <Text style={styles.readStatusButtonLabel}>다시 불러오기</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => returnToCalendar()}
            style={styles.readStatusButton}
          >
            <Text style={styles.readStatusButtonLabel}>캘린더로 돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.container, styles.recordContainer]}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.recordHeader}>
          <View style={styles.headerRow}>
            {backButton}
            <Text style={styles.dateLabel}>
              {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.recordHeading}>
            {viewing
              ? '육아 일기'
              : step === 'result'
                ? '하루의 이야기가 완성됐어요'
                : step === 'generating'
                  ? '오늘을 한 편의 이야기로'
                  : 'AI 육아 일기 생성'}
          </Text>
          <Text style={styles.recordHint}>
            {viewing
              ? '저장된 일기'
              : step === 'activities'
                ? '오늘 직접 한 활동을 골라주세요. 선택한 활동만 일기에 담아요.'
                : step === 'result'
                  ? '오늘의 기록을 한 편의 일기로 정리했어요.'
                  : '작은 시도와 웃음, 기억하고 싶은 순간을 적어주세요.'}
          </Text>
        </View>

        {step === 'activities' && (
          <>
            <ScrollView
              style={styles.recordScroll}
              contentContainerStyle={styles.recordList}
              keyboardShouldPersistTaps="handled"
            >
              {activityOptions.map((record) => {
                const selected = selectedRecordTimes.includes(record.time);
                return (
                  <Pressable
                    key={record.time}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${record.time} ${record.title}`}
                    aria-checked={selected}
                    onPress={() => toggleRecord(record.time)}
                    style={({ pressed }) => [
                      styles.recordCard,
                      selected && styles.recordSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.recordCopy}>
                      <View style={styles.recordTitleRow}>
                        <Text style={styles.recordTime}>{record.time}</Text>
                        <Text style={styles.recordTitle}>{record.title}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.recordCheck,
                        selected && styles.recordCheckSelected,
                      ]}
                    >
                      {selected ? (
                        <Text style={styles.recordCheckLabel}>✓</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.recordFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep('notes')}
                style={({ pressed }) => [
                  styles.recordNext,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.recordNextLabel}>다음으로</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 'notes' && (
          <>
            <ScrollView
              style={styles.recordScroll}
              contentContainerStyle={styles.growthContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.growthCard}>
                <Text accessibilityRole="header" style={styles.growthTitle}>
                  오늘의 성장 한 줄 기록
                </Text>
                <Text style={styles.growthSubtitle}>
                  오늘 아이에게 어떤 변화가 있었나요?
                </Text>
                <TextInput
                  accessibilityLabel="오늘의 성장 한 줄 기록"
                  placeholder="예: 오늘은 혼자서 숟가락을 잡으려 했어요."
                  placeholderTextColor="#858585"
                  multiline
                  maxLength={1000}
                  value={growthNote}
                  onChangeText={setGrowthNote}
                  textAlignVertical="top"
                  style={styles.growthInput}
                />
                <View style={styles.growthTags}>
                  {growthTags.map((tag) => (
                    <Pressable
                      key={tag}
                      accessibilityRole="button"
                      aria-pressed={selectedGrowthTags.includes(tag)}
                      onPress={() => toggleGrowthTag(tag)}
                      style={({ pressed }) => [
                        styles.growthTag,
                        {
                          flex:
                            tag === '#감정'
                              ? 0.8
                              : tag === '#언어/표현'
                                ? 1.1
                                : 1,
                        },
                        selectedGrowthTags.includes(tag) &&
                          styles.growthTagSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.growthTagLabel}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.growthHint}>
                  지금은 입력한 기록을 엮는 미리보기예요. AI 분석은 제공하지
                  않아요.
                </Text>
                <View style={styles.growthDivider} />
                <Text style={styles.photoLabel}>
                  {preparingPhotos ? '사진 준비 중...' : '사진 첨부 (선택)'}
                </Text>
                <View style={styles.photoRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      photoUri ? '첨부 사진 변경' : '사진 첨부'
                    }
                    onPress={selectPhoto}
                    disabled={preparingPhotos}
                    style={({ pressed }) => [
                      styles.photoButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.attachedPhoto}
                        contentFit="cover"
                        accessibilityLabel="첨부 사진"
                      />
                    ) : (
                      <Text style={styles.photoPlus}>+</Text>
                    )}
                    {photoUris.length > 1 ? (
                      <View style={styles.photoCount}>
                        <Text style={styles.photoCountLabel}>
                          {photoUris.length}장
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                  {photoUri ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="첨부 사진 삭제"
                      onPress={() => setPhotoUris([])}
                      style={styles.photoRemove}
                    >
                      <Text style={styles.photoRemoveLabel}>삭제</Text>
                    </Pressable>
                  ) : null}
                </View>
                {photoNotice ? (
                  <Text accessibilityRole="alert" style={styles.photoNotice}>
                    {photoNotice}
                  </Text>
                ) : null}
              </View>
            </ScrollView>
            <View style={styles.recordFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void createPreview()}
                disabled={
                  preparingPhotos || (!!result && regenerationsRemaining === 0)
                }
                style={({ pressed }) => [
                  styles.recordNext,
                  preparingPhotos && styles.pressed,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.recordNextLabel}>일기 생성하기</Text>
              </Pressable>
              {result ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('result')}
                  style={styles.quietAction}
                >
                  <Text style={styles.regenerateLabel}>
                    작성 중인 일기로 돌아가기
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}

        {step === 'generating' ? (
          <ScrollView
            style={styles.recordScroll}
            contentContainerStyle={styles.resultContent}
          >
            <DiaryGeneratingView />
          </ScrollView>
        ) : null}
        {(step === 'result' || step === 'saved') && (
          <>
            <ScrollView
              style={styles.recordScroll}
              contentContainerStyle={styles.resultContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <DiaryResultView
                result={{
                  content: displayedDraft,
                  emotions,
                  growthPoints,
                  tomorrowTip: viewing
                    ? savedQuery.data?.tomorrowTip
                    : result?.tomorrowTip,
                }}
                photos={displayedPhotos}
                source={
                  viewing ? savedQuery.data?.sourceRecords : sourceRecords
                }
                editingText={editingText}
                onChangeText={setEditingText}
                onEdit={
                  !viewing && !saving
                    ? () => {
                        setSaveNotice('');
                        setEditingText(draft);
                      }
                    : undefined
                }
                onCancel={() => {
                  Keyboard.dismiss();
                  setEditingText(null);
                }}
                onComplete={() => {
                  if (editingText?.trim()) {
                    setDraft(editingText.trim());
                    setEditingText(null);
                    Keyboard.dismiss();
                  }
                }}
              />
            </ScrollView>
            <View style={styles.resultFooter}>
              {saveNotice ? (
                <Text accessibilityRole="alert" style={styles.saveNotice}>
                  {saveNotice}
                </Text>
              ) : null}
              {editingText !== null ? (
                <Text style={styles.recordHint}>
                  본문에서 수정을 완료한 후 저장해주세요.
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || deleting || (!viewing && !draft.trim())}
                  onPress={() =>
                    viewing ? returnToCalendar() : void persistDiary()
                  }
                  style={({ pressed }) => [
                    styles.resultSave,
                    (pressed || saving || deleting) && styles.pressed,
                  ]}
                >
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.resultSaveLabel}
                  >
                    {viewing
                      ? '캘린더로 돌아가기'
                      : saving
                        ? '저장 중...'
                        : '이 일기 저장하기'}
                  </Text>
                </Pressable>
              )}
              {viewing ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => {
                    setDeleteNotice('');
                    setConfirmDelete(true);
                  }}
                  style={styles.quietAction}
                >
                  <Text style={styles.deleteLabel}>일기 삭제</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`다시 생성하기, 남은 횟수 ${regenerationsRemaining}회`}
                  disabled={regenerationsRemaining === 0 || saving}
                  onPress={requestRegeneration}
                  style={({ pressed }) => [
                    styles.quietAction,
                    (pressed || regenerationsRemaining === 0 || saving) &&
                      styles.pressed,
                  ]}
                >
                  <Text style={styles.regenerateLabel}>
                    다시 생성하기 · 이번 작성에서 {regenerationsRemaining}회
                    남음
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
        {step === 'notes' && saveNotice ? (
          <Text accessibilityRole="alert" style={styles.saveNotice}>
            {saveNotice}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingRef.current) setConfirmDelete(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            accessibilityViewIsModal
            style={styles.confirmationCard}
            contentContainerStyle={styles.confirmationContent}
          >
            <Text accessibilityRole="header" style={styles.confirmationTitle}>
              일기를 삭제할까요?
            </Text>
            <Text style={styles.recordStep}>
              {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일
            </Text>
            <Text style={styles.recordHint}>
              삭제한 일기는 복구할 수 없어요.
            </Text>
            {deleteNotice ? (
              <Text accessibilityRole="alert" style={styles.saveNotice}>
                {deleteNotice}
              </Text>
            ) : null}
            <View style={styles.deleteActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => setConfirmDelete(false)}
                style={[styles.regenerateButton, deleting && styles.pressed]}
              >
                <Text style={styles.deleteLabel}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={removeDiary}
                style={[styles.resultSave, deleting && styles.pressed]}
              >
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.resultSaveLabel}
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={confirmRegenerate || leaveAction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmRegenerate(false);
          setLeaveAction(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            accessibilityViewIsModal
            style={styles.confirmationCard}
            contentContainerStyle={styles.confirmationContent}
          >
            <Text accessibilityRole="header" style={styles.confirmationTitle}>
              {leaveAction
                ? '작성을 마칠까요?'
                : '수정한 일기를 다시 생성할까요?'}
            </Text>
            <Text style={styles.recordHint}>
              {leaveAction
                ? '저장하지 않은 기록은 사라져요.'
                : '수정한 본문이 새 초안으로 바뀌어요. 활동과 메모, 사진은 유지돼요.'}
            </Text>
            <View style={styles.deleteActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setConfirmRegenerate(false);
                  setLeaveAction(null);
                }}
                style={styles.regenerateButton}
              >
                <Text style={styles.deleteLabel}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (leaveAction) {
                    const leave = leaveAction;
                    setLeaveAction(null);
                    leave();
                  } else {
                    setConfirmRegenerate(false);
                    void createPreview(true);
                  }
                }}
                style={styles.resultSave}
              >
                <Text style={styles.resultSaveLabel}>
                  {leaveAction ? '나가기' : '다시 생성'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  flex: { flex: 1 },
  recordContainer: { backgroundColor: '#FAF9F9' },
  recordHeader: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { marginTop: -4, fontSize: 34, lineHeight: 38, color: '#4F4F4F' },
  recordHeading: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 32,
    color: '#D26A5C',
  },
  recordStep: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#4F4F4F',
  },
  recordHint: { fontSize: 13, lineHeight: 21, color: '#777574' },
  recordScroll: { backgroundColor: '#FAF9F9' },
  recordList: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingLeft: 18,
    paddingRight: 25,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 20,
  },
  recordCard: {
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordSelected: { borderColor: '#D26A5C', backgroundColor: '#FFF5F2' },
  recordCopy: { flex: 1 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  recordTime: {
    width: 36,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: '#4F4F4F',
  },
  recordTitle: { flex: 1, fontSize: 12, lineHeight: 18, color: '#4F4F4F' },
  recordCheck: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D26A5C',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCheckSelected: { backgroundColor: '#D26A5C' },
  recordCheckLabel: { fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  recordFooter: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAF9F9',
  },
  recordNext: {
    width: 239,
    minHeight: 51,
    borderRadius: 14,
    backgroundColor: '#B25447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordNextLabel: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
  },
  growthContent: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 21.5,
    paddingTop: 18,
    paddingBottom: 24,
  },
  growthCard: {
    paddingHorizontal: 18,
    paddingTop: 23,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  growthTitle: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 32,
    color: '#4F4F4F',
  },
  growthSubtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#4F4F4F',
  },
  growthInput: {
    minHeight: 144,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 25,
    color: '#4F4F4F',
  },
  growthTags: { marginTop: 12, flexDirection: 'row', gap: 9 },
  growthTag: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#FFE4DE',
    borderRadius: 12,
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthTagSelected: { borderColor: '#D26A5C', backgroundColor: '#FDEDE6' },
  growthTagLabel: { fontSize: 12, lineHeight: 18, color: '#4F4F4F' },
  growthHint: { marginTop: 13, fontSize: 12, lineHeight: 18, color: '#4F4F4F' },
  growthDivider: {
    marginTop: 26,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  photoLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#4F4F4F',
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoButton: {
    width: 102,
    height: 81,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlus: { fontSize: 23, fontWeight: '700', color: '#D26A5C' },
  attachedPhoto: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#D26A5C',
  },
  photoCountLabel: { fontSize: 11, lineHeight: 16, color: '#FFFFFF' },
  photoRemove: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  photoRemoveLabel: { fontSize: 12, color: '#D26A5C' },
  photoNotice: { marginTop: 8, fontSize: 12, lineHeight: 18, color: '#D26A5C' },
  confirmationCard: {
    width: '100%',
    maxWidth: 350,
    maxHeight: '90%',
    flexGrow: 0,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 8px 30px rgba(84, 87, 92, 0.12)',
  },
  confirmationContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  confirmationTitle: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 32,
    color: '#D26A5C',
  },
  resultContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 20,
  },
  resultFooter: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE8E5',
    backgroundColor: '#FAF9F9',
    gap: 4,
  },
  quietAction: {
    minHeight: 44,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: { fontSize: 13, lineHeight: 21, color: '#777574', flex: 1 },
  saveNotice: {
    fontSize: 12,
    lineHeight: 18,
    color: '#C9534A',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
  },
  readStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 18,
  },
  readStatusText: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 24,
    color: '#4F4F4F',
    textAlign: 'center',
  },
  readStatusButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDEDE6',
    borderRadius: 12,
  },
  readStatusButtonLabel: { fontFamily: 'Jua', fontSize: 16, color: '#D26A5C' },
  regenerateButton: {
    flex: 1,
    minHeight: 49,
    borderWidth: 2,
    borderColor: '#C2C3CB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  regenerateLabel: {
    fontSize: 13,
    lineHeight: 21,
    color: '#777574',
    textAlign: 'center',
  },
  resultSave: {
    minHeight: 50,
    flexShrink: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#B25447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultSaveLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(40, 35, 35, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  deleteLabel: { fontFamily: 'Jua', fontSize: 16, color: '#C9534A' },
  pressed: { opacity: 0.78 },
});
