import type { ReactNode } from 'react';

export type ScheduleAddMenuProps = {
  canAdd: boolean;
  onAdd: () => void;
  onRecommend: () => void;
  fallback: ReactNode;
};

export function ScheduleAddMenu({ fallback }: ScheduleAddMenuProps) {
  return <>{fallback}</>;
}
