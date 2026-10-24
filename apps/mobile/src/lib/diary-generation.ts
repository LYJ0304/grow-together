export type DiarySourceRecords = {
  activities: string[];
  note: string;
  tags: string[];
};

export type DiaryGenerationResult = {
  generationId?: string;
  content: string;
  emotions: string[];
  growthPoints: string[];
  tomorrowTip?: string | null;
  sourceTodoIds?: number[];
};

// shortcut: local composition only; replace this async boundary when an AI contract exists.
export async function generateDiary(
  date: Date,
  source: DiarySourceRecords,
): Promise<DiaryGenerationResult> {
  if (!source.activities.length && !source.note.trim()) {
    throw new Error('활동을 선택하거나 오늘의 관찰을 적어주세요.');
  }
  const paragraphs = [`${date.getMonth() + 1}월 ${date.getDate()}일의 기록`];
  if (source.activities.length) {
    paragraphs.push(
      `오늘은 ${source.activities.join(', ')}을(를) 함께한 하루였어요.`,
    );
  }
  if (source.note.trim()) paragraphs.push(source.note.trim());
  if (source.tags.length) paragraphs.push(source.tags.join(' '));
  return { content: paragraphs.join('\n\n'), emotions: [], growthPoints: [] };
}
