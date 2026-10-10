import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
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

const moments = [
  '잘 먹었어요',
  '즐겁게 놀았어요',
  '낮잠을 잤어요',
  '새로운 걸 해냈어요',
];
const moods = ['기분 좋은 하루', '평범하고 편안한 하루', '조금 힘든 하루'];
const tones = ['다정하고 따뜻하게', '짧고 담백하게', '재미있고 발랄하게'];

function formatDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : new Date();
}

export default function DiaryScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [date] = useState(() => formatDate(dateParam));
  const dateLabel = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState(moods[0]);
  const [selectedMoments, setSelectedMoments] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [tone, setTone] = useState(tones[0]);
  const [draft, setDraft] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);

  const createPreview = () => {
    const highlights = selectedMoments.length
      ? selectedMoments.join(' 하고 ')
      : '엄마 아빠와 함께 시간을 보냈어요';
    setDraft(
      `${date.getMonth() + 1}월 ${date.getDate()}일, ${mood}였어요.\n\n오늘은 ${highlights}. ${memo.trim() ? `${memo.trim()} ` : ''}하루하루 자라나는 모습이 참 사랑스러워요. 내일은 또 어떤 새로운 순간을 만나게 될까요?`,
    );
    setStep(3);
    setTimeout(() => setStep(4), 1200);
  };

  const toggleMoment = (moment: string) => {
    setSelectedMoments((current) =>
      current.includes(moment)
        ? current.filter((item) => item !== moment)
        : [...current, moment],
    );
  };

  const goBack = () => {
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else if (step === 4) setStep(2);
    else if (step === 5) setStep(4);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 1 ? '캘린더로 돌아가기' : '이전 단계'}
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>오늘의 일기</Text>
            <Text style={styles.headerDate}>{dateLabel}</Text>
          </View>
          <Text style={styles.stepLabel}>
            {step === 3 ? 'AI' : `${Math.min(step, 5)} / 5`}
          </Text>
        </View>

        {step === 1 && (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>오늘은 어떤 하루였나요?</Text>
              <Text style={styles.subtitle}>사랑둥이의 하루를 들려주세요.</Text>

              <Text style={styles.sectionTitle}>오늘의 기분</Text>
              <View style={styles.optionList}>
                {moods.map((item) => (
                  <Choice
                    key={item}
                    label={item}
                    selected={mood === item}
                    onPress={() => setMood(item)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>오늘 있었던 일</Text>
              <Text style={styles.helper}>여러 개 선택할 수 있어요</Text>
              <View style={styles.chips}>
                {moments.map((item) => (
                  <Choice
                    key={item}
                    label={item}
                    selected={selectedMoments.includes(item)}
                    onPress={() => toggleMoment(item)}
                    chip
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>기억하고 싶은 순간</Text>
              <TextInput
                accessibilityLabel="기억하고 싶은 순간"
                multiline
                maxLength={300}
                placeholder="작은 이야기라도 좋아요"
                placeholderTextColor="#A0A3B1"
                value={memo}
                onChangeText={setMemo}
                style={styles.memo}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{memo.length} / 300</Text>
            </ScrollView>
            <Footer label="다음" onPress={() => setStep(2)} />
          </>
        )}

        {step === 2 && (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>일기 분위기를 골라주세요</Text>
              <Text style={styles.subtitle}>
                마음에 드는 말투로 하루를 기록해요.
              </Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewEyebrow}>오늘의 기록</Text>
                <Text style={styles.previewLine}>{mood}</Text>
                <Text style={styles.previewLine}>
                  {selectedMoments.length
                    ? selectedMoments.join(' · ')
                    : '함께한 소중한 하루'}
                </Text>
                {memo ? <Text style={styles.memoPreview}>{memo}</Text> : null}
              </View>
              <Text style={styles.sectionTitle}>원하는 말투</Text>
              <View style={styles.optionList}>
                {tones.map((item) => (
                  <Choice
                    key={item}
                    label={item}
                    selected={tone === item}
                    onPress={() => setTone(item)}
                  />
                ))}
              </View>
            </ScrollView>
            <Footer label="일기 생성하기 ✨" onPress={createPreview} />
          </>
        )}

        {step === 3 && (
          <View style={styles.loadingScreen}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#D26A5C" />
              <Text style={styles.loadingTitle}>
                오늘의 일기를 만들고 있어요
              </Text>
              <Text style={styles.loadingSubtitle}>
                사랑둥이의 소중한 순간을 정리하는 중이에요.
              </Text>
              <View style={styles.loadingDots}>
                <Text style={styles.dot}>●</Text>
                <Text style={styles.dot}>●</Text>
                <Text style={styles.dot}>●</Text>
              </View>
            </View>
          </View>
        )}

        {step === 4 && (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>오늘의 일기가 완성됐어요</Text>
              <Text style={styles.subtitle}>
                마음에 들도록 자유롭게 다듬어보세요.
              </Text>
              <View style={styles.diaryCard}>
                <Text style={styles.previewEyebrow}>
                  {dateLabel} · {tone}
                </Text>
                <TextInput
                  accessibilityLabel="생성된 일기 수정"
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  style={styles.draftInput}
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.disclaimer}>
                화면 확인을 위한 예시 미리보기예요. 실제 AI 생성·저장은 아직
                연결되지 않았어요.
              </Text>
            </ScrollView>
            <Footer label="미리보기 확인" onPress={() => setStep(5)} />
          </>
        )}

        {step === 5 && (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.successMark}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={[styles.title, styles.center]}>
                일기 미리보기가 준비됐어요
              </Text>
              <Text style={[styles.subtitle, styles.center]}>
                작성한 내용을 확인했어요. 아직 서버에 저장되지는 않아요.
              </Text>
              <View style={styles.diaryCard}>
                <Text style={styles.previewEyebrow}>{dateLabel}</Text>
                <Text style={styles.finalDraft}>{draft}</Text>
              </View>
            </ScrollView>
            <Footer
              label="캘린더로 돌아가기"
              onPress={() => setConfirmExit(true)}
            />
          </>
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={confirmExit}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmExit(false)}
      >
        <View style={styles.modalOverlay}>
          <View accessibilityViewIsModal style={styles.confirmCard}>
            <View style={styles.confirmMark}>
              <Text style={styles.confirmIcon}>!</Text>
            </View>
            <Text accessibilityRole="header" style={styles.confirmTitle}>
              저장되지 않은 일기예요
            </Text>
            <Text style={styles.confirmMessage}>
              캘린더로 돌아가면 작성한 미리보기가 저장되지 않아요. 그래도
              나갈까요?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmExit(false)}
              style={({ pressed }) => [
                styles.confirmContinue,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmContinueText}>계속 작성하기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.confirmExit,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmExitText}>저장하지 않고 나가기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Choice({
  label,
  selected,
  onPress,
  chip = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  chip?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [
        chip ? styles.chip : styles.option,
        selected && (chip ? styles.selectedChip : styles.selectedOption),
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          chip ? styles.chipText : styles.optionText,
          selected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
      {!chip ? (
        <Text style={[styles.radio, selected && styles.selectedRadio]}>
          {selected ? '✓' : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Footer({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  flex: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDEC',
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  backIcon: { marginTop: -4, fontSize: 34, lineHeight: 38, color: '#4F4F4F' },
  headerText: { flex: 1, marginLeft: 13 },
  headerTitle: { fontFamily: 'Jua', fontSize: 18, color: '#4F4F4F' },
  headerDate: {
    marginTop: 2,
    fontFamily: 'Jua',
    fontSize: 12,
    color: '#99939A',
  },
  stepLabel: { fontFamily: 'Jua', fontSize: 13, color: '#D26A5C' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  title: { fontFamily: 'Jua', fontSize: 24, lineHeight: 32, color: '#4F4F4F' },
  subtitle: {
    marginTop: 7,
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 21,
    color: '#97929A',
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 11,
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#4F4F4F',
  },
  helper: {
    marginTop: -6,
    marginBottom: 13,
    fontFamily: 'Jua',
    fontSize: 12,
    color: '#A0A3B1',
  },
  optionList: { gap: 10 },
  option: {
    minHeight: 55,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: '#EFEDEC',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: { borderColor: '#D26A5C', backgroundColor: '#FFF5F2' },
  optionText: { fontFamily: 'Jua', fontSize: 14, color: '#5B5758' },
  selectedText: { color: '#D26A5C' },
  radio: {
    width: 21,
    height: 21,
    borderWidth: 1.5,
    borderColor: '#D8D4D3',
    borderRadius: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    color: '#FFFFFF',
  },
  selectedRadio: { borderColor: '#D26A5C', backgroundColor: '#D26A5C' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#EAE6E5',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  selectedChip: { borderColor: '#F3C9BD', backgroundColor: '#FFF0EB' },
  chipText: { fontFamily: 'Jua', fontSize: 13, color: '#706A6B' },
  memo: {
    minHeight: 112,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEDEC',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 22,
    color: '#4F4F4F',
  },
  counter: {
    marginTop: 6,
    textAlign: 'right',
    fontFamily: 'Jua',
    fontSize: 11,
    color: '#A0A3B1',
  },
  footer: {
    paddingHorizontal: 25,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1EFEE',
    backgroundColor: '#FAF9F9',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#D26A5C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: { fontFamily: 'Jua', fontSize: 18, color: '#FFFFFF' },
  previewCard: {
    marginTop: 27,
    padding: 21,
    borderWidth: 1,
    borderColor: '#F0E6E2',
    borderRadius: 22,
    backgroundColor: '#FFF5F2',
    gap: 11,
  },
  previewEyebrow: {
    marginBottom: 8,
    fontFamily: 'Jua',
    fontSize: 12,
    color: '#D26A5C',
  },
  previewLine: {
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 22,
    color: '#5C5553',
  },
  memoPreview: {
    marginTop: 4,
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 20,
    color: '#8D8581',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    minHeight: 320,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 30px rgba(84, 87, 92, 0.12)',
  },
  loadingTitle: {
    marginTop: 27,
    fontFamily: 'Jua',
    fontSize: 19,
    textAlign: 'center',
    color: '#4F4F4F',
  },
  loadingSubtitle: {
    marginTop: 9,
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#969098',
  },
  loadingDots: { marginTop: 22, flexDirection: 'row', gap: 8 },
  dot: { fontSize: 9, color: '#E7A18F' },
  diaryCard: {
    marginTop: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#F0E6E2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  draftInput: {
    minHeight: 250,
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 25,
    color: '#575152',
  },
  disclaimer: {
    marginTop: 15,
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 18,
    color: '#9E9797',
  },
  successMark: {
    width: 62,
    height: 62,
    marginTop: 14,
    marginBottom: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: '#FDEDE6',
  },
  successIcon: { fontSize: 31, color: '#D26A5C' },
  center: { textAlign: 'center' },
  finalDraft: {
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 25,
    color: '#575152',
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(40, 35, 35, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 350,
    paddingHorizontal: 25,
    paddingVertical: 27,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    boxShadow: '0px 8px 30px rgba(40, 35, 35, 0.16)',
  },
  confirmMark: {
    width: 46,
    height: 46,
    marginBottom: 15,
    borderRadius: 23,
    backgroundColor: '#FFF0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIcon: { fontFamily: 'Jua', fontSize: 25, color: '#D26A5C' },
  confirmTitle: {
    fontFamily: 'Jua',
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
    color: '#4F4F4F',
  },
  confirmMessage: {
    marginTop: 10,
    marginBottom: 22,
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#888187',
  },
  confirmContinue: {
    width: '100%',
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: '#D26A5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmContinueText: { fontFamily: 'Jua', fontSize: 15, color: '#FFFFFF' },
  confirmExit: {
    minHeight: 44,
    marginTop: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmExitText: { fontFamily: 'Jua', fontSize: 13, color: '#9A9291' },
  pressed: { opacity: 0.78 },
});
