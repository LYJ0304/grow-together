import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '../src/components/bottom-navigation';
import {
  useAuth,
  useChat,
  useChatDraft,
} from '../src/components/auth-provider';
import { useChatKeyboard } from '../src/lib/use-chat-keyboard';

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
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const { draft, setDraft } = useChatDraft();
  const keyboard = useChatKeyboard();
  const { status: authStatus } = useAuth();
  const chat = useChat();
  const busy = chat.status === 'connecting' || chat.status === 'streaming';
  const statusText = {
    idle: '상담을 시작해보세요',
    connecting: '답변을 요청하고 있어요',
    streaming: '답변을 작성하고 있어요',
    complete: '답변 완료',
    error: '응답 실패',
    stopped: '응답 중단',
  }[chat.status];
  const [notice, setNotice] = useState('');
  const [inputHeight, setInputHeight] = useState(48);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const field = input.current as unknown as HTMLTextAreaElement | null;
    if (!field) return;
    const previous = field.style.height;
    field.style.height = 'auto';
    const height = Math.max(48, Math.min(144, field.scrollHeight));
    field.style.height = previous;
    setInputHeight(height);
  }, [draft, width]);

  const send = () => {
    if (!draft.trim() || busy) return;
    if (authStatus !== 'authenticated') {
      setNotice('상담을 시작하려면 로그인해주세요.');
      return;
    }
    const text = draft.trim();
    if (text.length > 4000) {
      setNotice('질문은 4,000자 이내로 입력해주세요.');
      return;
    }
    void chat.client.send(text);
    if (chat.client.getSnapshot().status === 'connecting') setDraft('');
    setNotice('');
    input.current?.focus();
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.container,
        keyboard.viewport && {
          flex: 0,
          height: keyboard.viewport.height,
          transform: [{ translateY: keyboard.viewport.offsetTop }],
        },
      ]}
    >
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <View style={styles.avatar} accessible={false} />
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.personaName}>
              차분한 상담선생님
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={styles.connectionStatus}
            >
              {statusText}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="상담 설정"
            onPress={() => setNotice('설정 기능은 준비 중이에요.')}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../assets/images/chat/settings.svg')}
              style={styles.settingsIcon}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
        </View>

        {chat.messages.length > 0 && !busy && (
          <Pressable
            accessibilityRole="button"
            onPress={() => chat.client.clear()}
            style={styles.newChat}
          >
            <Text>새 상담</Text>
          </Pressable>
        )}
        <ScrollView
          ref={scroll}
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: true })
          }
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {chat.messages.length === 0 && (
            <>
              <Text style={styles.intro}>이 시기에는 이런 질문이 많아요</Text>
              <View style={styles.suggestions}>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.question}
                    accessibilityRole="button"
                    accessibilityLabel={`질문 입력: ${item.question}`}
                    onPress={() => {
                      setDraft(item.question);
                      input.current?.focus();
                    }}
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
            </>
          )}
          {chat.messages.map((message, index) => (
            <View
              key={`${message.id}-${index}`}
              style={[
                styles.bubble,
                message.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text style={styles.messageRole}>
                {message.role === 'user' ? '나' : '상담선생님'}
              </Text>
              <Text selectable style={styles.messageText}>
                {typeof message.content === 'string' ? message.content : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
        {chat.notice !== '' && (
          <Text accessibilityRole="alert" style={styles.chatNotice}>
            {chat.notice}
          </Text>
        )}
        {busy && (
          <Pressable
            accessibilityRole="button"
            onPress={chat.client.stop}
            style={styles.newChat}
          >
            <Text>응답 중단</Text>
          </Pressable>
        )}
        {!busy && chat.retryText !== '' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void chat.client.retry()}
            style={styles.newChat}
          >
            <Text>다시 시도</Text>
          </Pressable>
        )}

        {notice !== '' && (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="안내 닫기"
              onPress={() => {
                setNotice('');
                input.current?.focus();
              }}
              style={styles.dismissNotice}
            >
              <Text accessible={false}>×</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.composer}>
          <TextInput
            ref={input}
            accessibilityLabel="상담 질문 입력"
            placeholder="궁금한 점을 뭐든지 물어보세요"
            placeholderTextColor="#A0A3B1"
            value={draft}
            onChangeText={setDraft}
            multiline
            numberOfLines={1}
            blurOnSubmit={false}
            submitBehavior="newline"
            onContentSizeChange={(event) => {
              if (Platform.OS !== 'web') {
                setInputHeight(
                  Math.max(
                    48,
                    Math.min(144, event.nativeEvent.contentSize.height),
                  ),
                );
              }
            }}
            onKeyPress={(event) => {
              if (
                Platform.OS !== 'web' ||
                !window.matchMedia('(hover: hover) and (pointer: fine)').matches
              )
                return;
              const key = event.nativeEvent as unknown as KeyboardEvent;
              if (
                key.key === 'Enter' &&
                !key.shiftKey &&
                !key.isComposing &&
                key.keyCode !== 229
              ) {
                event.preventDefault();
                send();
              }
            }}
            onSubmitEditing={send}
            style={[styles.input, { height: inputHeight }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="질문 보내기"
            accessibilityState={{ disabled: !draft.trim() || busy }}
            disabled={!draft.trim() || busy}
            onPress={() => {
              send();
              input.current?.focus();
            }}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || busy) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
        {!keyboard.visible && (
          <BottomNavigation
            active="질문"
            onReselect={() =>
              scroll.current?.scrollTo({ y: 0, animated: true })
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  newChat: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  chatNotice: { paddingHorizontal: 24, paddingVertical: 8, color: '#4F4F4F' },
  bubble: { padding: 16, borderRadius: 18, maxWidth: '92%', marginBottom: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#FDEDE6' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF' },
  messageRole: { fontSize: 12, color: '#777574', marginBottom: 6 },
  messageText: { fontSize: 16, lineHeight: 24, color: '#4F4F4F' },
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  keyboard: { flex: 1, minHeight: 0 },
  header: {
    minHeight: 67,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  headerCopy: { flex: 1, gap: 3 },
  personaName: {
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 20,
    color: '#D26A5C',
  },
  connectionStatus: {
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#777574',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EAE6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { width: 22, height: 22 },
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
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 5px 18px rgba(84, 87, 92, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    color: '#4F4F4F',
  },
  notice: {
    marginHorizontal: 12,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDE6',
    borderRadius: 12,
    flexShrink: 0,
  },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#4F4F4F' },
  dismissNotice: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { fontSize: 23, color: '#D26A5C' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
});
