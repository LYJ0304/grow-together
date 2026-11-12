import { PageIntro } from '../../src/components/page-intro';
import { editorial } from '../../src/theme/editorial';
import { colors } from '../../src/theme/colors';
import { useTabInteraction } from '../../src/components/tab-interaction';
import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { AppHeader } from '../../src/components/app-header';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

import { useChatDraft } from '../../src/components/auth-provider';
import { typography } from '../../src/components/typography';
import { useChatKeyboard } from '../../src/lib/use-chat-keyboard';

const suggestions = [
  {
    question: '오늘 집에서 할 놀이를 추천해줘',
    preview: '지금 여유 있는 시간과 준비물을 적어보세요.',
  },
  {
    question: '어제 좋아했던 활동을 이어서 하고 싶어',
    preview: '어떤 활동을 좋아했는지 알려주세요.',
  },
  {
    question: '아이의 이런 반응을 어떻게 이해하면 좋을까?',
    preview: '함께한 상황과 아이의 반응을 적어보세요.',
  },
];

export default function CounselorChatScreen() {
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const scroll = useRef<ScrollView>(null);
  useTabScrollToTop(scroll);
  const input = useRef<TextInput>(null);
  const { width, height } = useWindowDimensions();
  const { draft, setDraft } = useChatDraft();
  const keyboard = useChatKeyboard();
  useTabInteraction(false, keyboard.visible);
  const [notice, setNotice] = useState('');
  const [inputHeight, setInputHeight] = useState(48);
  const [inputFocused, setInputFocused] = useState(false);
  // Leave room for the header and notices when the viewport is short.
  const inputMaxHeight = Math.max(
    48,
    Math.min(144, Math.floor((keyboard.viewport?.height ?? height) / 4)),
  );

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const field = input.current as unknown as HTMLTextAreaElement | null;
    if (!field) return;
    const previous = field.style.height;
    field.style.height = 'auto';
    const height = Math.max(48, Math.min(inputMaxHeight, field.scrollHeight));
    field.style.height = previous;
    setInputHeight(height);
  }, [draft, width, inputMaxHeight]);

  useEffect(() => {
    if (notice) scroll.current?.scrollToEnd({ animated: false });
  }, [notice]);

  useEffect(() => {
    if (compose === 'true') {
      input.current?.focus();
      router.setParams({ compose: '' });
    }
  }, [compose]);

  const send = () => {
    if (!draft.trim()) return;
    setNotice(
      '육아 도우미 연결은 아직 준비 중이에요. 질문 초안은 이 세션에서 유지돼요.',
    );
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <AppHeader section="질문" />

        <ScrollView
          ref={scroll}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          <PageIntro
            eyebrow="ASK & REFLECT"
            title="육아 도우미"
            description="함께 고민해요. 궁금한 점과 기억하고 싶은 순간을 질문으로 남겨보세요."
          />
          <View style={editorial.hero}>
            <Text style={editorial.section}>현재 연결 준비 중</Text>
            <Text style={editorial.description}>
              아직 AI 답변을 연결하지 않았어요. 질문 초안은 이 세션에서
              유지돼요.
            </Text>
          </View>
          <Text style={styles.intro}>이런 질문으로 시작해보세요</Text>
          <View style={styles.suggestions}>
            {suggestions.map((item) => (
              <Pressable
                key={item.question}
                accessibilityRole="button"
                accessibilityLabel={`질문 입력: ${item.question}`}
                onPress={() => {
                  if (draft.trim()) {
                    setNotice('작성 중인 질문을 먼저 마무리해주세요.');
                  } else {
                    setDraft(item.question);
                    setNotice('');
                  }
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
                <Image
                  source={require('../../assets/images/chat/arrow-up-right.svg')}
                  style={styles.suggestionArrow}
                  contentFit="contain"
                  accessible={false}
                />
              </Pressable>
            ))}
          </View>
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
        </ScrollView>

        <View style={[styles.composer, inputFocused && styles.composerFocused]}>
          <TextInput
            ref={input}
            accessibilityLabel="상담 질문 입력"
            placeholder="궁금한 점을 뭐든지 물어보세요"
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            multiline
            numberOfLines={1}
            blurOnSubmit={false}
            submitBehavior="newline"
            onContentSizeChange={(event) => {
              if (Platform.OS !== 'web') {
                setInputHeight(
                  Math.max(
                    48,
                    Math.min(
                      inputMaxHeight,
                      event.nativeEvent.contentSize.height,
                    ),
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
            style={[
              styles.input,
              { height: Math.min(inputHeight, inputMaxHeight) },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="질문 보내기"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={() => {
              send();
              input.current?.focus();
            }}
            style={({ pressed }) => [
              styles.sendButton,
              !draft.trim() && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../../assets/images/chat/send.svg')}
              style={styles.sendIcon}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1, minHeight: 0 },
  messages: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  intro: {
    marginBottom: 12,
    marginTop: 24,
    textAlign: 'left',
    ...typography.button,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  suggestions: { gap: 10 },
  suggestion: {
    minHeight: 88,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionCopy: { flex: 1, minWidth: 0, gap: 6 },
  question: { ...typography.button, color: colors.text },
  preview: { ...typography.label, color: colors.muted },
  suggestionArrow: { width: 20, height: 20, flexShrink: 0 },
  composer: {
    minHeight: 58,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerFocused: { borderColor: colors.primary },
  input: {
    ...typography.body,
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    lineHeight: 24,
    textAlignVertical: 'top',
    ...Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 0 } }),
    color: colors.text,
  },
  notice: {
    marginHorizontal: 20,
    paddingLeft: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tint,
    borderRadius: 12,
    flexShrink: 0,
  },
  noticeText: { ...typography.label, flex: 1, color: colors.text },
  dismissNotice: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    marginBottom: 2,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { width: 22, height: 22 },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: colors.primary },
});
