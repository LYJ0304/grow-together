import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useChatDraft } from './auth-provider';
import { typography } from './typography';

export function HomeQuestionEntry() {
  const { draft } = useChatDraft();
  const continuing = !!draft.trim();
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          continuing ? '작성하던 질문 이어쓰기' : '육아 질문 작성하기'
        }
        accessibilityHint="육아 도우미 화면의 입력창으로 이동해요"
        onPress={() =>
          router.push({ pathname: '/chat', params: { compose: 'true' } })
        }
        style={styles.entry}
      >
        <Image
          source={require('../../assets/images/brand/emblem.svg')}
          style={styles.emblem}
          contentFit="contain"
          accessible={false}
        />
        <Text style={styles.prompt}>
          {continuing ? '작성하던 질문 이어쓰기' : '육아 도우미에게 물어보세요'}
        </Text>
        <Text style={styles.arrow} accessible={false}>
          ›
        </Text>
      </Pressable>
      <Text style={styles.hint}>
        답변 연결 준비 중 · 질문 초안은 이 세션에서 유지돼요.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 8 },
  entry: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4D8D0',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  emblem: { width: 28, height: 28 },
  prompt: { ...typography.body, color: '#625B57', flex: 1, minWidth: 0 },
  arrow: { fontSize: 26, color: '#A84D40' },
  hint: { ...typography.caption, color: '#625B57', paddingHorizontal: 8 },
});
