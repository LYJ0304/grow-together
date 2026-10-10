import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const suggestions = [
  {
    question: '아직 안 걷는데 괜찮나요?',
    preview: '걷기는 18개월까지 기다려보셔도 괜찮아요.',
  },
  {
    question: '이 시기에 말을 안 해도 되나요?',
    preview: '옹알이만 해도 괜찮은 시기예요, 너무 걱정 마세요.',
  },
  {
    question: '밤에 자주 깨요 왜죠?',
    preview: '성장통이나 불안 때문일 수 있어요. 루틴 점검도 좋아요.',
  },
  {
    question: '편식이 심한데 어쩌죠?',
    preview: '편식은 흔한 일이에요, 즐겁게 식사 분위기 만들어주세요.',
  },
];

export default function CounselorChatScreen() {
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    Alert.alert('상담 기능 준비 중', 'AI 상담 연결은 아직 준비 중이에요.');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="페르소나 선택으로 돌아가기"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.avatar} accessible={false} />
          <View style={styles.headerCopy}>
            <Text style={styles.personaName}>차분한 상담선생님</Text>
            <Text style={styles.online}>
              <Text style={styles.onlineDot}>●</Text> Online
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="상담 설정"
            onPress={() =>
              Alert.alert('상담 설정', '설정 기능은 준비 중이에요.')
            }
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.intro}>이 시기에는 이런 질문이 많아요</Text>
          <View style={styles.suggestions}>
            {suggestions.map((item) => (
              <Pressable
                key={item.question}
                accessibilityRole="button"
                accessibilityLabel={`질문 입력: ${item.question}`}
                onPress={() => setDraft(item.question)}
                style={({ pressed }) => [
                  styles.suggestion,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.suggestionCopy}>
                  <Text style={styles.question}>“{item.question}”</Text>
                  <Text style={styles.preview}>{item.preview}</Text>
                </View>
                <Text style={styles.suggestionArrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="상담 질문 입력"
            placeholder="궁금한 점을 뭐든지 물어보세요"
            placeholderTextColor="#A0A3B1"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            returnKeyType="send"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="음성 입력"
            onPress={() =>
              Alert.alert('음성 입력', '음성 입력 기능은 준비 중이에요.')
            }
            hitSlop={6}
          >
            <Text style={styles.micIcon}>♩</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="질문 보내기"
            onPress={send}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  keyboard: { flex: 1 },
  header: {
    minHeight: 67,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 12px rgba(84, 87, 92, 0.08)',
  },
  backIcon: { marginTop: -4, fontSize: 34, lineHeight: 38, color: '#4F4F4F' },
  avatar: {
    width: 30,
    height: 30,
    marginLeft: 24,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  headerCopy: { flex: 1, marginLeft: 8 },
  personaName: {
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 20,
    color: '#D26A5C',
  },
  online: { fontFamily: 'Jua', fontSize: 12, lineHeight: 16, color: '#487B61' },
  onlineDot: { color: '#65A87B', fontSize: 10 },
  settingsButton: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 27, color: '#4F4F4F' },
  messages: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 39,
    paddingBottom: 18,
  },
  intro: {
    marginBottom: 32,
    textAlign: 'center',
    fontFamily: 'Jua',
    fontSize: 14,
    color: '#4F4F4F',
  },
  suggestions: { gap: 34 },
  suggestion: {
    minHeight: 98,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 32,
    backgroundColor: '#FDEDE6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionCopy: { flex: 1, gap: 9 },
  question: {
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 19,
    color: '#4F4F4F',
  },
  preview: {
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#A09892',
  },
  suggestionArrow: { marginTop: -10, fontSize: 19, color: '#8C837D' },
  composer: {
    minHeight: 56,
    marginHorizontal: 30,
    marginTop: 10,
    marginBottom: 10,
    paddingLeft: 22,
    paddingRight: 14,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 5px 18px rgba(84, 87, 92, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontFamily: 'Jua',
    fontSize: 13,
    color: '#4F4F4F',
  },
  micIcon: { fontSize: 20, color: '#A0A3B1' },
  sendButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { fontSize: 23, color: '#D26A5C' },
  pressed: { opacity: 0.75 },
});
