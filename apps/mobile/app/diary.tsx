import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
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
  diaryDateKey,
  parseDiaryDate,
  readDiary,
  saveDiary,
} from '../src/lib/diary-storage';

const diaryRecords = [
  {
    time: '07:00',
    title: '기상 & 기저귀 갈기',
    description: '아이가 깼어요. 기저귀를 갈아주세요.',
    tag: '#기본 루틴',
  },
  {
    time: '07:30',
    title: '아침 이유식',
    description: '아침 식사 시간이에요. 새로운 재료를 시도해요.',
    tag: '#식습관 안정화',
  },
  {
    time: '09:00',
    title: '놀이 & 탐색',
    description: '탐색 놀이 시간이에요. 블록이나 촉감놀이 추천!',
    tag: '#발달 자극',
  },
  {
    time: '10:00',
    title: '낮잠 (1~1.5시간)',
    description: '졸려할 수 있어요. 조용한 환경을 만들어주세요.',
    tag: '#휴식 루틴',
  },
  {
    time: '12:30',
    title: '산책 & 외부 활동',
    description: '햇볕을 쬐면 비타민 D 합성에 좋아요.',
    tag: '#활동/면역',
  },
  {
    time: '14:00',
    title: '책 읽기 & 놀이',
    description: '짧은 그림책을 같이 읽어주세요.',
    tag: '#언어 발달',
  },
  {
    time: '15:00',
    title: '낮잠 (1시간)',
    description: '점심 시간이에요. 새로운 식감 시도도 좋아요.',
    tag: '#피로 회복',
  },
  {
    time: '17:30',
    title: '산책 / 외부 활동',
    description: '밥을 잘 먹을 수 있도록 산책을 해요.',
    tag: '#발달 자극',
  },
  {
    time: '18:00',
    title: '저녁 이유식',
    description: '저녁 식사 시간이에요. 단백질 식품을 포함해보세요.',
    tag: '#성장 #영양',
  },
  {
    time: '19:30',
    title: '책 읽기 & 차분한 놀이',
    description: '짧은 그림책을 읽어주며 하루를 마무리해요.',
    tag: '#언어 발달 #정서 안정',
  },
  {
    time: '20:00',
    title: '취침 준비',
    description: '잔잔한 조명과 음악으로 잠잘 분위기를 만들어주세요.',
    tag: '#수면 유도',
  },
  {
    time: '21:00',
    title: '취침',
    description: '오늘 하루가 끝났어요. 아기를 재워주세요.',
    tag: '#마무리',
  },
];
const growthTags = ['#성취/시도', '#언어/표현', '#감정'];
const sampleEmotions = ['성취감', '호기심', '만족스러움', '차분함'];
// shortcut: sample interpretations for UI preview; replace with the AI response when connected.
const sampleGrowthPoints = [
  '자립심 발달: 숟가락을 스스로 잡으려는 시도가 늘었어요.',
  '집중력 향상: 블록 놀이에서 전보다 긴 시간 집중했어요.',
  '관심 표현: 산책 중 사물을 가리키며 표현하려 했어요.',
  '정서 안정: 부모와 함께하는 책 읽기에 차분하게 집중했어요.',
];

export default function DiaryScreen() {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const { date: dateParam, mode } = useLocalSearchParams<{
    date?: string;
    mode?: string;
  }>();
  const viewing = mode === 'view';
  const [date] = useState(() => parseDiaryDate(dateParam) ?? new Date());
  const dateKey = diaryDateKey(date);
  const [step, setStep] = useState(viewing ? 5 : 1);
  const savedQuery = useQuery({
    queryKey: ['savedDiary', dateKey],
    queryFn: () => readDiary(dateKey),
    enabled: viewing,
    retry: false,
  });
  const [selectedRecordTimes, setSelectedRecordTimes] = useState<string[]>([]);
  const selectedRecords = diaryRecords.filter((record) =>
    selectedRecordTimes.includes(record.time),
  );
  const [growthNote, setGrowthNote] = useState('');
  const [selectedGrowthTags, setSelectedGrowthTags] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const photoUri = photoUris[0] ?? null;
  const [photoNotice, setPhotoNotice] = useState('');
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [draft, setDraft] = useState('');
  const [regenerationsRemaining, setRegenerationsRemaining] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const savingRef = useRef(false);
  const displayedDraft = viewing ? (savedQuery.data?.content ?? '') : draft;
  const displayedPhotos = viewing
    ? (savedQuery.data?.photoUris ?? [])
    : photoUris;
  const emotions = viewing ? (savedQuery.data?.emotions ?? []) : sampleEmotions;
  const growthPoints = viewing
    ? (savedQuery.data?.growthPoints ?? [])
    : sampleGrowthPoints;

  const returnToCalendar = (saved = false) =>
    router.dismissTo({
      pathname: '/calendar',
      params: { date: dateKey, saved: saved ? 'true' : '' },
    });

  const persistDiary = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveNotice('');
    try {
      await saveDiary({
        date: dateKey,
        content: draft,
        emotions: sampleEmotions,
        growthPoints: sampleGrowthPoints,
        photoUris,
      });
      returnToCalendar(true);
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
    if (step !== 3) return;
    // shortcut: show a sample after the loading preview; replace with the AI response when connected.
    const timer = setTimeout(() => setStep(4), 3000);
    return () => clearTimeout(timer);
  }, [step]);

  const createPreview = () => {
    const highlights = selectedRecords.length
      ? selectedRecords.map((record) => record.title).join(', ')
      : '엄마 아빠와 함께한 시간';
    setDraft(
      `${date.getMonth() + 1}월 ${date.getDate()}일의 기록\n\n오늘 기억하고 싶은 순간은 ${highlights}이에요. 하루하루 자라나는 모습이 참 사랑스러워요. 내일은 또 어떤 새로운 순간을 만나게 될까요?${growthNote.trim() ? `\n\n오늘의 성장 기록\n${growthNote.trim()}` : ''}${selectedGrowthTags.length ? `\n\n${selectedGrowthTags.join(' ')}` : ''}`,
    );
    Keyboard.dismiss();
    setStep(3);
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
          <Text accessibilityRole="header" style={styles.recordHeading}>
            AI 육아 일기 생성
          </Text>
          <Text style={styles.recordStep}>
            {viewing
              ? '저장된 일기'
              : step === 1
                ? 'STEP 01 : 남기고 싶은 기억을 골라봐요!'
                : step >= 4
                  ? 'STEP 04 : 추가로 남기고 싶은 기록이 있나요?'
                  : 'STEP 02 : 추가로 남기고 싶은 기록이 있나요?'}
          </Text>
          <Text style={styles.recordHint}>
            {viewing
              ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
              : step === 1
                ? '아이와 오늘 한 활동을 선택해주세요.'
                : step >= 4
                  ? '아이의 하루가 하나의 이야기로 완성되었습니다.'
                  : '오늘 아이에게 어떤 변화가 있었나요? 작은 시도나 웃음도 괜찮아요.'}
          </Text>
        </View>

        {step === 1 && (
          <>
            <ScrollView
              style={styles.recordScroll}
              contentContainerStyle={styles.recordList}
              keyboardShouldPersistTaps="handled"
            >
              {diaryRecords.map((record) => {
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
                      <Text style={styles.recordDescription}>
                        {record.description}
                      </Text>
                      <Text style={styles.recordTag}>{record.tag}</Text>
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
                onPress={() => setStep(2)}
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

        {(step === 2 || step === 3) && (
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
                  짧은 문장이라도 괜찮아요. AI가 의미를 분석해드려요.
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
                onPress={createPreview}
                disabled={preparingPhotos}
                style={({ pressed }) => [
                  styles.recordNext,
                  preparingPhotos && styles.pressed,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.recordNextLabel}>일기 생성하기</Text>
              </Pressable>
            </View>
          </>
        )}

        {(step === 4 || step === 5) && (
          <>
            <ScrollView
              key={`result-${step}`}
              style={styles.recordScroll}
              contentContainerStyle={styles.resultContent}
              keyboardShouldPersistTaps="handled"
            >
              {step === 5 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoGallery}
                  contentContainerStyle={styles.photoGalleryContent}
                  accessibilityLabel="일기 사진 목록"
                >
                  {(displayedPhotos.length
                    ? displayedPhotos
                    : [null, null, null]
                  ).map((uri, index) => (
                    <View key={index} style={styles.galleryTile}>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={styles.galleryPhoto}
                          contentFit="cover"
                          accessibilityLabel={`일기 사진 ${index + 1}`}
                        />
                      ) : (
                        <Text style={styles.galleryPlaceholder}>사진 없음</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              <View style={[styles.resultCard, styles.resultDiaryCard]}>
                <View style={styles.resultHeadingRow}>
                  <View style={styles.resultIcon} />
                  <Text accessibilityRole="header" style={styles.resultHeading}>
                    오늘의 일기
                  </Text>
                </View>
                {photoUri && step === 4 ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={[styles.diaryPhoto, styles.resultPhoto]}
                    contentFit="cover"
                    accessibilityLabel="일기 첨부 사진"
                  />
                ) : null}
                <Text style={styles.resultBody}>{displayedDraft}</Text>
              </View>
              <View style={styles.resultCard}>
                <View style={styles.resultHeadingRow}>
                  <View style={styles.resultIcon} />
                  <Text accessibilityRole="header" style={styles.resultHeading}>
                    오늘의 감정
                  </Text>
                </View>
                <Text style={styles.resultBody}>{emotions.join(', ')}</Text>
              </View>
              <View style={[styles.resultCard, styles.resultGrowthCard]}>
                <View style={styles.resultHeadingRow}>
                  <View style={styles.resultIcon} />
                  <Text accessibilityRole="header" style={styles.resultHeading}>
                    성장 포인트
                  </Text>
                </View>
                <View style={styles.resultGrowthPoints}>
                  {growthPoints.map((point) => (
                    <Text key={point} style={styles.resultGrowthPoint}>
                      · {point}
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.resultFooter}>
              {saveNotice ? (
                <Text accessibilityRole="alert" style={styles.saveNotice}>
                  {saveNotice}
                </Text>
              ) : null}
              <View style={styles.resultActions}>
                {!viewing ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`다시 생성하기, 남은 횟수 ${regenerationsRemaining}회`}
                    disabled={regenerationsRemaining === 0 || saving}
                    onPress={() => {
                      setRegenerationsRemaining((remaining) => remaining - 1);
                      createPreview();
                    }}
                    style={({ pressed }) => [
                      styles.regenerateButton,
                      (pressed || regenerationsRemaining === 0) &&
                        styles.pressed,
                    ]}
                  >
                    <Text style={styles.regenerateLabel}>
                      다시 생성하기{'\n'}(1일 {regenerationsRemaining}/3번)
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() =>
                    viewing
                      ? returnToCalendar()
                      : step === 4
                        ? setStep(5)
                        : persistDiary()
                  }
                  style={({ pressed }) => [
                    styles.resultSave,
                    (pressed || saving) && styles.pressed,
                  ]}
                >
                  <Text style={styles.resultSaveLabel}>
                    {viewing
                      ? '캘린더로 돌아가기'
                      : step === 4
                        ? '다음으로'
                        : saving
                          ? '저장 중...'
                          : '저장하기'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={step === 3}
        transparent
        animationType="fade"
        onRequestClose={() => setStep(2)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            accessibilityViewIsModal
            style={styles.loadingCard}
            contentContainerStyle={styles.loadingContent}
          >
            <Text accessibilityRole="header" style={styles.loadingTitle}>
              AI 일기 생성 중입니다...
            </Text>
            <Text style={styles.loadingSubtitle}>
              오늘의 기록을 바탕으로 아이의 하루를 정리하고 있어요.
            </Text>
            <Text style={styles.loadingDetails}>
              성장 의미 + 내일 조언이 포함돼요.
            </Text>
            <View style={styles.loadingSummary}>
              <Text
                accessibilityRole="header"
                style={styles.loadingSummaryTitle}
              >
                일기에는 이런 내용이 들어가요
              </Text>
              <View style={styles.loadingItems}>
                {[
                  '오늘의 루틴 요약 (기상·식사·놀이·휴식)',
                  '메모 키워드 분석 (행복, 성취, 피곤 등)',
                  '사진/메모 연동 (선택)',
                ].map((label) => (
                  <View key={label} style={styles.loadingItem}>
                    <View style={styles.loadingBullet} />
                    <Text style={styles.loadingItemLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="일기 생성 중"
                style={styles.loadingProgress}
              >
                <Text style={styles.loadingProgressLabel}>
                  AI가 성장 포인트를 찾아 정리해요
                </Text>
              </View>
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
  recordContainer: { backgroundColor: '#FFFFFF' },
  recordHeader: {
    paddingTop: 26,
    paddingBottom: 24,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.12)',
    zIndex: 1,
  },
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
  recordHint: { marginTop: 7, fontSize: 12, lineHeight: 18, color: '#222222' },
  recordScroll: { backgroundColor: '#FAF9F9' },
  recordList: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingLeft: 18,
    paddingRight: 25,
    paddingTop: 24,
    paddingBottom: 105,
    gap: 20,
  },
  recordCard: {
    minHeight: 90,
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
  recordDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#4F4F4F',
  },
  recordTag: { marginTop: 1, fontSize: 12, lineHeight: 18, color: '#4F4F4F' },
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
    position: 'absolute',
    bottom: 26,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordNext: {
    width: 239,
    minHeight: 51,
    borderRadius: 14,
    backgroundColor: '#D26A5C',
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
    paddingBottom: 105,
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
    height: 188,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    fontSize: 12,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  growthTags: { marginTop: 12, flexDirection: 'row', gap: 9 },
  growthTag: {
    flex: 1,
    minHeight: 31,
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
  diaryPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 15,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 350,
    maxHeight: '90%',
    flexGrow: 0,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 8px 30px rgba(84, 87, 92, 0.12)',
  },
  loadingContent: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 20 },
  loadingTitle: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 32,
    color: '#D26A5C',
  },
  loadingSubtitle: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#606060',
  },
  loadingDetails: {
    marginTop: 18,
    fontSize: 12,
    lineHeight: 18,
    color: '#606060',
  },
  loadingSummary: {
    marginTop: 18,
    minHeight: 256,
    marginHorizontal: -4,
    padding: 22,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderRadius: 16,
    backgroundColor: '#FAF9F9',
  },
  loadingSummaryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#111111',
  },
  loadingItems: { marginTop: 19, gap: 16 },
  loadingItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  loadingBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E58A78',
  },
  loadingItemLabel: { flex: 1, fontSize: 12, lineHeight: 20, color: '#111111' },
  loadingProgress: {
    marginTop: 24,
    minHeight: 36,
    borderWidth: 2,
    borderColor: '#FFE4DE',
    borderRadius: 18,
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  loadingProgressLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#D26A5C',
  },
  resultContent: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  resultCard: {
    padding: 18,
    borderWidth: 2,
    borderColor: '#F2F2F2',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  resultDiaryCard: { minHeight: 252 },
  resultHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultIcon: { width: 16, height: 16, backgroundColor: '#4F4F4F' },
  resultHeading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#4F4F4F',
  },
  resultBody: { marginTop: 8, fontSize: 12, lineHeight: 20, color: '#606060' },
  resultPhoto: { marginTop: 12, marginBottom: 0 },
  resultGrowthCard: { minHeight: 186 },
  resultGrowthPoints: { marginTop: 14, gap: 8 },
  resultGrowthPoint: { fontSize: 12, lineHeight: 20, color: '#606060' },
  resultFooter: {
    position: 'absolute',
    bottom: 26,
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  resultActions: { flexDirection: 'row', gap: 22 },
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
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 18,
    color: '#A0A3B1',
    textAlign: 'center',
  },
  resultSave: {
    flex: 1,
    minHeight: 49,
    borderRadius: 10,
    backgroundColor: '#D26A5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultSaveLabel: {
    fontFamily: 'Jua',
    fontSize: 20,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  photoGallery: { height: 130, flexGrow: 0, flexShrink: 0, marginRight: -24 },
  photoGalleryContent: { gap: 20 },
  galleryTile: {
    width: 130,
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F0EBE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPhoto: { width: '100%', height: '100%' },
  galleryPlaceholder: { fontSize: 12, color: '#A0A3B1' },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(40, 35, 35, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78 },
});
