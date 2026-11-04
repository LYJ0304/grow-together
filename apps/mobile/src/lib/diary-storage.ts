import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiarySourceRecords } from './diary-generation';

const prefix = '@growtogether/diary/v1/';

export type SavedDiary = {
  date: string;
  content: string;
  emotions: string[];
  growthPoints: string[];
  photoUris: string[];
  tomorrowTip?: string | null;
  sourceRecords?: DiarySourceRecords;
};

export function diaryDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDiaryDate(value?: string): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return diaryDateKey(date) === value ? date : null;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isSavedDiary(value: unknown): value is SavedDiary {
  if (!value || typeof value !== 'object') return false;
  const diary = value as Partial<SavedDiary>;
  return (
    typeof diary.date === 'string' &&
    parseDiaryDate(diary.date) !== null &&
    typeof diary.content === 'string' &&
    diary.content.trim().length > 0 &&
    (diary.tomorrowTip === undefined ||
      diary.tomorrowTip === null ||
      typeof diary.tomorrowTip === 'string') &&
    (diary.sourceRecords === undefined ||
      (diary.sourceRecords !== null &&
        typeof diary.sourceRecords === 'object' &&
        stringArray(diary.sourceRecords.activities) &&
        typeof diary.sourceRecords.note === 'string' &&
        stringArray(diary.sourceRecords.tags))) &&
    stringArray(diary.emotions) &&
    stringArray(diary.growthPoints) &&
    stringArray(diary.photoUris) &&
    diary.photoUris.length <= 3 &&
    diary.photoUris.every((uri) =>
      /^data:image\/(jpeg|png|webp);base64,/.test(uri),
    )
  );
}

export async function savedDiaryDates(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter((date) => parseDiaryDate(date) !== null)
      .sort();
  } catch {
    throw new Error('저장된 일기 목록을 불러오지 못했어요. 다시 시도해주세요.');
  }
}

export async function readDiary(date: string): Promise<SavedDiary | null> {
  if (!parseDiaryDate(date)) throw new Error('날짜를 확인해주세요.');
  try {
    const raw = await AsyncStorage.getItem(prefix + date);
    if (raw === null) return null;
    const diary: unknown = JSON.parse(raw);
    if (!isSavedDiary(diary) || diary.date !== date)
      throw new Error('Invalid diary');
    return diary;
  } catch {
    throw new Error('저장된 일기를 불러오지 못했어요. 다시 시도해주세요.');
  }
}

function encodeDiary(diary: SavedDiary): string {
  if (!isSavedDiary(diary)) throw new Error('일기 내용을 확인해주세요.');
  const encoded = JSON.stringify(diary);
  if (encoded.length > 1_500_000)
    throw new Error(
      '본문이나 사진 용량이 커서 저장하지 못했어요. 내용을 줄여 다시 시도해주세요.',
    );
  return encoded;
}

export async function saveDiary(diary: SavedDiary): Promise<void> {
  const encoded = encodeDiary(diary);
  let existing: string | null;
  try {
    existing = await AsyncStorage.getItem(prefix + diary.date);
  } catch {
    throw new Error('저장소를 확인하지 못했어요. 다시 시도해주세요.');
  }
  if (existing !== null)
    throw new Error('이미 저장된 날짜예요. 캘린더에서 일기를 확인해주세요.');
  try {
    await AsyncStorage.setItem(prefix + diary.date, encoded);
  } catch {
    throw new Error(
      '일기를 저장하지 못했어요. 기기의 저장 공간을 확인한 후 다시 시도해주세요.',
    );
  }
}

export async function deleteDiary(date: string): Promise<void> {
  if (!parseDiaryDate(date)) throw new Error('날짜를 확인해주세요.');
  try {
    await AsyncStorage.removeItem(prefix + date);
  } catch {
    throw new Error('일기를 삭제하지 못했어요. 다시 시도해주세요.');
  }
}

export async function updateDiary(
  date: string,
  content: string,
): Promise<SavedDiary> {
  if (!content.trim()) throw new Error('일기 내용을 확인해주세요.');
  const original = await readDiary(date);
  if (!original)
    throw new Error('수정할 일기가 없어요. 캘린더에서 다시 확인해주세요.');
  const diary = { ...original, content: content.trim() };
  const encoded = encodeDiary(diary);
  try {
    await AsyncStorage.setItem(prefix + date, encoded);
    return diary;
  } catch {
    throw new Error(
      '일기를 저장하지 못했어요. 기기의 저장 공간을 확인한 후 다시 시도해주세요.',
    );
  }
}
