import { memo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRecordPreview } from '../../lib/use-records';
import { parseDiaryDate } from '../../lib/diary-storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { ActionButton } from '../action-button';

export const RecordCard = memo(function RecordCard({
  date,
  visible,
  selected,
  disabled,
  onOpen,
}: {
  date: string;
  visible: boolean;
  selected: boolean;
  disabled: boolean;
  onOpen(date: string, id?: number): void;
}) {
  const query = useRecordPreview(date, visible);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const day = parseDiaryDate(date)!;
  const label = `${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일`;
  const photo = query.data?.photo;
  return (
    <View testID={`record-card-${date}`} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selected ? '선택한 날짜의 일기 보기' : `${label} 일기 보기`
        }
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => onOpen(date, query.data?.id)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {photo && photo !== failedPhoto ? (
          <Image
            source={{ uri: photo }}
            contentFit="cover"
            accessible={false}
            onError={() => setFailedPhoto(photo)}
            style={styles.photo}
          />
        ) : null}
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {selected
              ? '이날의 일기'
              : `${day.getMonth() + 1}월 ${day.getDate()}일 · 일기`}
          </Text>
          <Text numberOfLines={2} style={styles.preview}>
            {query.data?.content.trim() ||
              (query.isError
                ? '기록 내용을 불러오지 못했어요.'
                : query.isPending
                  ? '기록을 불러오는 중이에요.'
                  : '이날 남긴 일기를 다시 읽어보세요.')}
          </Text>
        </View>
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      </Pressable>
      {query.isError ? (
        <View style={styles.error}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            기록 내용을 불러오지 못했어요.
          </Text>
          <ActionButton
            label="기록 다시 불러오기"
            variant="secondary"
            onPress={() => void query.refetch()}
          />
        </View>
      ) : null}
    </View>
  );
});
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  row: {
    minHeight: 104,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { backgroundColor: colors.tint },
  photo: { width: 72, height: 72, borderRadius: 10 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  title: { ...typography.button, color: colors.heading },
  preview: { ...typography.caption, color: colors.muted },
  chevron: { fontSize: 24, color: colors.muted },
  error: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  errorText: { ...typography.caption, color: colors.danger },
});
