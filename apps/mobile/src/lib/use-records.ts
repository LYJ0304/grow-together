import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../components/auth-provider';
import { createDiaryApi } from './features/diary/diaryApi';
import type { DiaryResponse } from './features/diary/types';
import { readDiary, savedDiaryDates, type SavedDiary } from './diary-storage';

export function useRecordIndex(months: string[], visibleDates: string[]) {
  const { client, status, epoch } = useAuth();
  const preview = status === 'preview';
  const scope = preview ? 'preview' : epoch;
  const queryClient = useQueryClient();
  const activeMonths = useRef(months);
  activeMonths.current = months;
  const activeDates = useRef(visibleDates);
  activeDates.current = visibleDates;
  const local = useQuery({
    queryKey: ['savedDiaryDates', 'preview'],
    queryFn: savedDiaryDates,
    enabled: preview,
    staleTime: 30_000,
    retry: false,
  });
  const remote = useQueries({
    queries: months.map((month) => ({
      queryKey: ['savedDiaryDates', epoch, month],
      queryFn: async () =>
        (await createDiaryApi(client).getMonth(month))
          .map((row) => row.diaryDate)
          .filter((date) => date.startsWith(month)),
      enabled: status === 'authenticated',
      staleTime: 30_000,
      retry: false,
    })),
  });
  const stateFor = (month: string) =>
    preview ? local : remote[months.indexOf(month)];
  const dates = new Set(
    preview ? (local.data ?? []) : remote.flatMap((query) => query.data ?? []),
  );
  const refresh = useCallback(() => {
    const keys = preview
      ? [['savedDiaryDates', 'preview']]
      : activeMonths.current.map((month) => ['savedDiaryDates', epoch, month]);
    for (const queryKey of keys) {
      // Initial queries already own their pending request; refresh cached data on return.
      const state = queryClient.getQueryState(queryKey);
      if (
        state?.fetchStatus !== 'fetching' &&
        (state?.dataUpdatedAt || state?.status === 'error')
      )
        void queryClient.invalidateQueries({ queryKey, exact: true });
    }
    for (const date of activeDates.current) {
      const queryKey = ['diaryByDate', scope, date];
      const state = queryClient.getQueryState(queryKey);
      if (state?.fetchStatus !== 'fetching' && state?.dataUpdatedAt)
        void queryClient.invalidateQueries({ queryKey, exact: true });
    }
  }, [preview, epoch, scope, queryClient]);
  useFocusEffect(refresh);
  return {
    dates,
    stateFor,
    refresh,
    retry: () => {
      for (const query of preview ? [local] : remote) void query.refetch();
    },
    queries: preview ? [local] : remote,
  };
}

export type RecordPreview = {
  id?: number;
  date: string;
  content: string;
  photo?: string;
};
export function useRecordPreview(date: string, visible: boolean) {
  const { client, status, epoch } = useAuth();
  const preview = status === 'preview';
  return useQuery<DiaryResponse | SavedDiary | null, Error, RecordPreview>({
    queryKey: ['diaryByDate', preview ? 'preview' : epoch, date],
    queryFn: () =>
      preview ? readDiary(date) : createDiaryApi(client).getByDate(date),
    enabled: visible && (preview || status === 'authenticated'),
    staleTime: (query) => (query.state.data ? 30_000 : 0),
    retry: false,
    select: (value) => {
      if (!value) throw new Error('기록을 다시 확인해주세요.');
      if (preview) {
        const local = value as SavedDiary;
        return { date, content: local.content, photo: local.photoUris[0] };
      }
      const remote = value as DiaryResponse;
      return {
        id: remote.id,
        date,
        content: remote.content ?? '',
        photo: remote.diaryFiles?.[0]?.imageUrl,
      };
    },
  });
}
