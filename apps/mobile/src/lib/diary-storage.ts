import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = '@growtogether/diary/v1/';

export type SavedDiary = {
  date: string;
  content: string;
  emotions: string[];
  growthPoints: string[];
  photoUris: string[];
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

export async function saveDiary(diary: SavedDiary): Promise<void> {
  if (!isSavedDiary(diary)) throw new Error('일기 내용을 확인해주세요.');
  const encoded = JSON.stringify(diary);
  if (encoded.length > 1_500_000)
    throw new Error(
      '사진 용량이 커서 저장하지 못했어요. 사진을 줄여 다시 시도해주세요.',
    );
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
