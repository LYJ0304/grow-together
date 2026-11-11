import { typography } from '../src/components/typography';
import { colors } from '../src/theme/colors';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const personas = [
  {
    id: 'warm-mom',
    name: '따뜻한 친정엄마',
    description: '감정에 먼저 공감하고,\n아이 중심의 부드러운 육아를 추천해요.',
    tags: '# 감정 중심  # 실패에 위로  # 부드러운 육아',
    quote: '괜찮아, 너도 잘하고 있어. 억지로 안 해도 괜찮단다 :)',
  },
  {
    id: 'realistic-mom',
    name: '조용한 현실맘',
    description: '과하지 않게,\n매일매일 반복되는 루틴을 함께 지켜가요.',
    tags: '# 계획 중심  # 공감보다는 팁 위주',
    quote: '하루에 세 가지만 해도 충분해요. 규칙이 아이를 편하게 해줘요.',
  },
  {
    id: 'counselor',
    name: '육아 도우미',
    description:
      '정답은 몰라도, 흐름은 알 수 있어요.\n루틴과 구조를 함께 만들어가는 육아 조력자예요.',
    tags: '# 육아 원리 제시  # 부모와 아이를 함께 보는 시야',
    quote: '아이 반응은 예민한 흐름일 수 있어요. 안정 루틴을 잡아볼까요?',
  },
] as const;

export default function PersonaScreen() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="질문으로 돌아가기"
        onPress={() => router.dismissTo('/chat')}
        style={{ minHeight: 44, padding: 12 }}
      >
        <Text>‹ 육아 도우미</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            누구랑 같이 키워볼까요?
          </Text>
          <Text style={styles.subtitle}>
            아이는 언제든 바꿀 수 있어요.{'\n'}
            먼저 마음에 드는 친구부터 시작해볼까요?
          </Text>
        </View>

        <View style={styles.personaList}>
          {personas.map((persona) => {
            const selected = selectedPersona === persona.id;
            return (
              <View key={persona.id} style={styles.card}>
                <View style={styles.personaInfo}>
                  <View style={styles.avatar} accessible={false} />
                  <View style={styles.personaCopy}>
                    <Text style={styles.name}>{persona.name}</Text>
                    <Text style={styles.description}>
                      {persona.description}
                    </Text>
                    <Text style={styles.tags}>{persona.tags}</Text>
                  </View>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteMark}>“</Text>
                  <Text style={styles.quote}>{persona.quote}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${persona.name} 페르소나 선택`}
                  aria-pressed={selected}
                  onPress={() => {
                    setSelectedPersona(persona.id);
                    if (persona.id === 'counselor') router.dismissTo('/chat');
                  }}
                  style={({ pressed }) => [
                    styles.chooseButton,
                    selected && styles.chosenButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.chooseLabel}>
                    {selected ? '선택했어요' : '같이 해볼래요'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  heading: { alignItems: 'center', marginBottom: 8 },
  title: {
    ...typography.section,
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  personaList: { gap: 16 },
  card: {
    minHeight: 191,
    padding: 16,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  personaInfo: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.field,
  },
  avatar: {
    width: 48,
    height: 48,
    marginTop: 4,
    borderRadius: 24,
    backgroundColor: colors.background,
  },
  personaCopy: { flex: 1 },
  name: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
  },
  description: {
    marginTop: 3,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  tags: {
    marginTop: 5,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.primary,
  },
  quoteRow: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quoteMark: {
    ...typography.button,
    fontSize: 17,
    lineHeight: 20,
    color: colors.text,
  },
  quote: {
    flex: 1,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.text,
  },
  chooseButton: {
    minHeight: 48,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosenButton: { backgroundColor: colors.tint },
  chooseLabel: { ...typography.caption, fontSize: 13, color: colors.onTint },
  pressed: { opacity: 0.75 },
});
