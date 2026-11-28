import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { ActionButton } from '../action-button';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Attachments remain in the parent's session draft; the viewer owns no copied file data.
export function DiaryPhotos({
  photos,
  editable,
  canAdd,
  busy,
  onAdd,
  onRemove,
}: {
  photos: string[];
  editable: boolean;
  canAdd: boolean;
  busy: boolean;
  onAdd(): void;
  onRemove(index: number): void;
}) {
  const [current, setCurrent] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const opener = useRef<ComponentRef<typeof View> | null>(null);
  const thumbnails = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const close = () => {
    setCurrent(null);
    setConfirm(false);
    requestAnimationFrame(() => opener.current?.focus());
  };
  useEffect(() => {
    if (current === null || Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [current]);
  const position = Math.min(current ?? 0, Math.max(0, photos.length - 1));
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.heading}>
          오늘의 사진
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {photos.length} / 3장
        </Text>
      </View>
      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <Pressable
            key={`${index}:${uri.slice(-30)}`}
            ref={(node) => {
              thumbnails.current[index] = node;
            }}
            accessibilityRole="button"
            accessibilityLabel={`사진 ${index + 1} 크게 보기`}
            onPress={() => {
              opener.current = thumbnails.current[index];
              setCurrent(index);
              setConfirm(false);
            }}
            style={styles.cell}
          >
            <Photo
              uri={uri}
              label={`일기 사진 ${index + 1}, 총 ${photos.length}장`}
            />
          </Pressable>
        ))}
        {editable && canAdd && photos.length < 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            disabled={busy}
            onPress={onAdd}
            style={[styles.cell, styles.add]}
          >
            <Text style={styles.plus}>+</Text>
            <Text style={styles.caption}>사진 추가</Text>
          </Pressable>
        ) : null}
      </View>
      {editable && !canAdd ? (
        <Text style={styles.caption}>
          새 사진의 계정 저장은 준비 중이에요. 기존 사진은 확인하거나 첨부에서
          뺄 수 있어요.
        </Text>
      ) : null}
      {editable && canAdd ? (
        <Text style={styles.caption}>
          사진은 일기를 저장할 때 업로드돼요. 최대 3장까지 첨부할 수 있어요.
        </Text>
      ) : null}
      {!photos.length && !editable ? (
        <Text style={styles.caption}>첨부한 사진이 없어요.</Text>
      ) : null}
      {current !== null && photos.length ? (
        <Modal
          visible
          animationType="none"
          onRequestClose={close}
          onDismiss={() => opener.current?.focus()}
        >
          <SafeAreaView style={styles.viewer}>
            <View
              accessibilityViewIsModal
              role="dialog"
              accessibilityLabel="일기 사진 미리보기"
              style={styles.viewerBody}
            >
              <View style={styles.row}>
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  style={styles.viewerLabel}
                >
                  {position + 1} / {photos.length}
                </Text>
                <ActionButton
                  label="사진 닫기"
                  variant="tertiary"
                  onPress={close}
                />
              </View>
              <Photo
                uri={photos[position]}
                full
                label={`사진 원본 ${position + 1}`}
              />
              <ScrollView
                style={styles.controls}
                contentContainerStyle={{ gap: 12 }}
              >
                <View style={styles.row}>
                  <ActionButton
                    label="이전 사진"
                    variant="tertiary"
                    disabled={position === 0 || confirm}
                    onPress={() => setCurrent(position - 1)}
                  />
                  <ActionButton
                    label="다음 사진"
                    variant="tertiary"
                    disabled={position === photos.length - 1 || confirm}
                    onPress={() => setCurrent(position + 1)}
                  />
                </View>
                {editable ? (
                  confirm ? (
                    <View style={{ gap: 12 }}>
                      <Text style={styles.viewerLabel}>
                        이 사진을 첨부에서 뺄까요? 저장하기 전까지 원래 기록은
                        바뀌지 않아요.
                      </Text>
                      <View style={styles.row}>
                        <ActionButton
                          label="사진 유지"
                          variant="tertiary"
                          onPress={() => setConfirm(false)}
                        />
                        <ActionButton
                          label="첨부에서 빼기"
                          variant="tertiary"
                          disabled={busy}
                          onPress={() => {
                            onRemove(position);
                            setConfirm(false);
                            if (photos.length === 1) close();
                            else
                              setCurrent(Math.min(position, photos.length - 2));
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <ActionButton
                      label="이 사진 제거"
                      variant="tertiary"
                      disabled={busy}
                      onPress={() => setConfirm(true)}
                    />
                  )
                ) : null}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
function Photo({
  uri,
  label,
  full = false,
}: {
  uri: string;
  label: string;
  full?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={full ? styles.original : styles.thumbnail}>
      {failed ? (
        <Text
          accessibilityRole="alert"
          style={full ? styles.viewerLabel : styles.caption}
        >
          사진을 불러오지 못했어요.
        </Text>
      ) : (
        <Image
          source={{ uri }}
          contentFit={full ? 'contain' : 'cover'}
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  heading: { ...typography.section, color: colors.heading },
  caption: { ...typography.caption, color: colors.muted },
  grid: { flexDirection: 'row', gap: 10 },
  cell: {
    width: '30%',
    aspectRatio: 1,
    minHeight: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  add: {
    backgroundColor: colors.surface,
    borderColor: colors.controlBorder,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: { fontSize: 28, color: colors.primary },
  thumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    padding: 6,
  },
  viewer: { flex: 1, backgroundColor: colors.heading },
  viewerBody: { flex: 1, padding: 16, gap: 12 },
  viewerLabel: { ...typography.body, color: colors.surface },
  original: {
    flex: 1,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: { flexGrow: 0, maxHeight: '45%' },
});
