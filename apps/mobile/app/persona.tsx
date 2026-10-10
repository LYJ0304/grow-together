import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '../src/components/bottom-navigation';

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
    name: '차분한 상담선생님',
    description:
      '정답은 몰라도, 흐름은 알 수 있어요.\n루틴과 구조를 함께 만들어가는 육아 조력자예요.',
    tags: '# 육아 원리 제시  # 부모와 아이를 함께 보는 시야',
    quote: '아이 반응은 예민한 흐름일 수 있어요. 안정 루틴을 잡아볼까요?',
  },
] as const;

export default function PersonaScreen() {
  const scroll = useRef<ScrollView>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
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
                    if (persona.id === 'counselor') router.push('/chat');
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
      <BottomNavigation
        active="질문"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: { paddingHorizontal: 33, paddingTop: 50, paddingBottom: 20 },
  heading: { alignItems: 'center', marginBottom: 8 },
  title: {
    fontFamily: 'Jua',
    fontSize: 22,
    lineHeight: 30,
    color: '#4F4F4F',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#88889D',
    textAlign: 'center',
  },
  personaList: { gap: 27 },
  card: {
    minHeight: 191,
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 5px 18px rgba(84, 87, 92, 0.08)',
  },
  personaInfo: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F5',
  },
  avatar: {
    width: 48,
    height: 48,
    marginTop: 4,
    borderRadius: 24,
    backgroundColor: '#FAF9F9',
  },
  personaCopy: { flex: 1 },
  name: { fontFamily: 'Jua', fontSize: 15, lineHeight: 19, color: '#4F4F4F' },
  description: {
    marginTop: 3,
    fontFamily: 'Jua',
    fontSize: 11,
    lineHeight: 14,
    color: '#88889D',
  },
  tags: {
    marginTop: 5,
    fontFamily: 'Jua',
    fontSize: 10,
    lineHeight: 13,
    color: '#D26A5C',
  },
  quoteRow: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quoteMark: {
    fontFamily: 'Jua',
    fontSize: 17,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  quote: {
    flex: 1,
    fontFamily: 'Jua',
    fontSize: 10,
    lineHeight: 14,
    color: '#4F4F4F',
  },
  chooseButton: {
    height: 39,
    borderRadius: 20,
    backgroundColor: '#FDEDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosenButton: { backgroundColor: '#F7D5C9' },
  chooseLabel: { fontFamily: 'Jua', fontSize: 13, color: '#D26A5C' },
  pressed: { opacity: 0.75 },
});
