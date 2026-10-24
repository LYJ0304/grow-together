import { Image } from 'expo-image';
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
      <ActivityIndicator color="#B25447" accessibilityLabel="일기 생성 중" />
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
            <Action label="수정" onPress={onEdit} />
          ) : null}
        </View>
        {editingText === null ? (
          <Text style={styles.body} selectable>
            {result.content}
          </Text>
        ) : (
          <>
            <TextInput
              accessibilityLabel="일기 본문 수정"
              multiline
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
              <Action label="취소" onPress={onCancel} />
              <Action
                label="수정 완료"
                disabled={!editingText.trim()}
                onPress={onComplete}
              />
            </View>
          </>
        )}
        {onEdit ? (
          <Text style={styles.caption}>
            기록을 엮은 초안 · 저장 전 자유롭게 다듬어주세요
          </Text>
        ) : null}
      </View>
      <DiaryPhotoGallery photos={photos} />
      {hasInsights ? (
        <View style={styles.insights}>
          {result.growthPoints.length ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.title}>
                오늘 발견한 성장 순간
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
                기록 속 감정
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
            accessibilityLabel="이 일기에 사용된 기록 확인"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={({ pressed }) => [
              styles.disclosure,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.meta, styles.grow]}>
              이 일기에 사용된 기록 확인
            </Text>
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
}: {
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
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paper: {
    padding: 22,
    borderWidth: 1,
    borderColor: '#EEE8E5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
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
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    color: '#292929',
    flexShrink: 1,
  },
  body: { fontSize: 16, lineHeight: 27, color: '#494442' },
  caption: { fontSize: 12, lineHeight: 19, color: '#777574' },
  meta: { fontSize: 13, lineHeight: 21, color: '#777574' },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#B25447',
    fontWeight: '600',
  },
  editor: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#D26A5C',
    borderRadius: 8,
    backgroundColor: '#FAF9F9',
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
    backgroundColor: '#EEE8E5',
  },
  insights: { paddingHorizontal: 4 },
  section: {
    paddingVertical: 18,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE8E5',
  },
  observation: { fontSize: 15, lineHeight: 25, color: '#494442' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF1EC',
  },
  chipText: { color: '#914C41', fontSize: 13, lineHeight: 20 },
  sources: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE8E5',
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 8,
  },
  sourceBody: { gap: 10, paddingBottom: 16 },
  sourceText: { fontSize: 14, lineHeight: 23, color: '#494442' },
  generating: { gap: 20 },
  skeleton: { height: 12, borderRadius: 4, backgroundColor: '#EEE8E5' },
  pressed: { opacity: 0.65 },
});
