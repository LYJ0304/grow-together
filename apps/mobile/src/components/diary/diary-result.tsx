import {
  buttonSurface,
  buttonLabel,
  type ButtonVariant,
} from '../../theme/buttons';
import { editorial } from '../../theme/editorial';
import { colors } from '../../theme/colors';
import { Image } from 'expo-image';
import { typography } from '../typography';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  DiaryGenerationResult,
  DiarySourceRecords,
} from '../../lib/diary-generation';
import { useEffect, useState } from 'react';

export function DiaryGeneratingView() {
  return (
    <View
      style={styles.generating}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator
        color={colors.primary}
        accessibilityLabel="일기 생성 중"
      />
      <Text accessibilityRole="header" style={styles.title}>
        오늘의 이야기를 정리하고 있어요
      </Text>
      <Text style={styles.meta}>
        선택한 활동과 메모를 바탕으로 일기를 작성하고 있어요.
      </Text>
      <View
        style={styles.paper}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[100, 92, 100, 68].map((width, index) => (
          <View key={index} style={[styles.skeleton, { width: `${width}%` }]} />
        ))}
      </View>
    </View>
  );
}

type Props = {
  result: DiaryGenerationResult;
  photos: string[];
  source?: DiarySourceRecords;
  editingText: string | null;
  persisted?: boolean;
  busy?: boolean;
  onChangeText: (text: string) => void;
  onEdit?: () => void;
  onCancel: () => void;
  onComplete: () => void;
};

export function DiaryResultView({
  result,
  photos,
  source,
  editingText,
  persisted = false,
  busy = false,
  onChangeText,
  onEdit,
  onCancel,
  onComplete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editorHeight, setEditorHeight] = useState<number>();
  useEffect(() => {
    if (editingText === null) setEditorHeight(undefined);
  }, [editingText]);
  const hasInsights =
    result.growthPoints.length > 0 ||
    result.emotions.length > 0 ||
    !!result.tomorrowTip?.trim();
  return (
    <>
      <View style={styles.paper}>
        <View style={styles.headingRow}>
          <Image
            source={require('../../../assets/images/diary-book.svg')}
            style={styles.book}
            contentFit="contain"
            accessible={false}
          />
          <Text accessibilityRole="header" style={[styles.title, styles.grow]}>
            오늘의 일기
          </Text>
          {onEdit && editingText === null ? (
            <Action label="내용 수정" onPress={onEdit} />
          ) : null}
        </View>
        {editingText === null ? (
          <Text style={styles.body} selectable>
            {result.content}
          </Text>
        ) : (
          <>
            <TextInput
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              accessibilityLabel="일기 본문 수정"
              multiline
              editable={!busy}
              autoFocus
              textAlignVertical="top"
              scrollEnabled={false}
              value={editingText}
              onChangeText={onChangeText}
              onContentSizeChange={({ nativeEvent }) =>
                setEditorHeight(Math.ceil(nativeEvent.contentSize.height) + 2)
              }
              style={[
                styles.body,
                styles.editor,
                editorHeight === undefined
                  ? undefined
                  : { height: editorHeight },
              ]}
            />
            {!editingText.trim() ? (
              <Text accessibilityLiveRegion="polite" style={styles.meta}>
                일기 내용을 입력해주세요.
              </Text>
            ) : null}
            <View style={styles.editActions}>
              <Action label="취소" disabled={busy} onPress={onCancel} />
              <Action
                label={
                  persisted
                    ? busy
                      ? '저장 중...'
                      : '변경사항 저장'
                    : '수정 완료'
                }
                disabled={busy || !editingText.trim()}
                variant="primary"
                onPress={onComplete}
              />
            </View>
          </>
        )}
        {onEdit ? (
          <Text style={styles.caption}>
            {persisted
              ? '저장된 일기의 본문을 수정할 수 있어요.'
              : '기록을 엮은 초안 · 저장 전 자유롭게 다듬어주세요'}
          </Text>
        ) : null}
      </View>
      <DiaryPhotoGallery photos={photos} />
      {hasInsights ? (
        <View style={styles.insights}>
          {result.growthPoints.length ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.title}>
                오늘 관찰한 순간
              </Text>
              {result.growthPoints.map((point, index) => (
                <Text key={index} style={styles.observation}>
                  · {point}
                </Text>
              ))}
            </View>
          ) : null}
          {result.emotions.length ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.title}>
                기록에서 추정한 감정
              </Text>
              <Text style={styles.meta}>
                기록을 바탕으로 한 추정이에요. 아이와 보호자의 실제 감정과 다를
                수 있어요.
              </Text>
              <View style={styles.chips}>
                {result.emotions.map((emotion, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{emotion}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {result.tomorrowTip?.trim() ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.title}>
                내일의 작은 제안
              </Text>
              <Text style={styles.observation}>{result.tomorrowTip}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {source &&
      (source.activities.length > 0 ||
        source.note.trim() ||
        source.tags.length > 0) ? (
        <View style={styles.sources}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사용한 기록 보기"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={({ pressed }) => [
              styles.disclosure,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.meta, styles.grow]}>사용한 기록 보기</Text>
            <Text style={styles.meta}>{expanded ? '−' : '+'}</Text>
          </Pressable>
          {expanded ? (
            <View style={styles.sourceBody}>
              {source.activities.map((activity, index) => (
                <Text key={index} style={styles.sourceText}>
                  · {activity}
                </Text>
              ))}
              {source.note.trim() ? (
                <Text style={styles.sourceText}>{source.note}</Text>
              ) : null}
              {source.tags.length ? (
                <Text style={styles.meta}>{source.tags.join(' ')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function DiaryPhotoGallery({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="일기 사진 목록"
      style={styles.gallery}
      contentContainerStyle={styles.galleryContent}
    >
      {photos.slice(0, 3).map((uri, index) => (
        <Image
          key={index}
          source={{ uri }}
          contentFit="cover"
          style={styles.photo}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`일기 사진 ${index + 1}, 총 ${Math.min(3, photos.length)}장`}
        />
      ))}
    </ScrollView>
  );
}

function Action({
  label,
  onPress,
  disabled = false,
  variant = 'tertiary',
}: {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        buttonSurface(variant, disabled, pressed),
      ]}
    >
      <Text style={[styles.actionText, buttonLabel(variant, disabled)]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paper: {
    ...editorial.card,
    gap: 18,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  book: { width: 20, height: 20 },
  grow: { flex: 1 },
  title: {
    ...typography.section,
    color: colors.text,
    flexShrink: 1,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  caption: {
    ...typography.caption,
    color: colors.muted,
  },
  meta: {
    ...typography.caption,
    color: colors.muted,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.button,
    color: colors.primary,
  },
  editor: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  editActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  gallery: { flexGrow: 0, flexShrink: 0 },
  galleryContent: { gap: 10 },
  photo: {
    width: 152,
    height: 114,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  insights: { paddingHorizontal: 4 },
  section: {
    paddingVertical: 18,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  observation: {
    ...typography.body,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.tint,
  },
  chipText: {
    ...typography.caption,
    color: colors.onTint,
  },
  sources: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 8,
  },
  sourceBody: { gap: 10, paddingBottom: 16 },
  sourceText: {
    ...typography.body,
    color: colors.text,
  },
  generating: { gap: 20 },
  skeleton: { height: 12, borderRadius: 4, backgroundColor: colors.border },
  pressed: { backgroundColor: colors.border },
});
