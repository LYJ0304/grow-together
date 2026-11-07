from datetime import time, timedelta

from .schemas import ActivityProposal, ScheduleCandidate, ScheduleGenerationRequest


def time_offset(value: time) -> timedelta:
    return timedelta(
        hours=value.hour, minutes=value.minute, seconds=value.second, microseconds=value.microsecond
    )


def available_intervals(request: ScheduleGenerationRequest) -> list[tuple[timedelta, timedelta]]:
    merged = []
    for window in sorted(request.available_windows, key=lambda window: window.start):
        start, end = time_offset(window.start), time_offset(window.end)
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


class ScheduleScheduler:
    def schedule(
        self,
        request: ScheduleGenerationRequest,
        activities: list[ActivityProposal],
    ) -> tuple[list[ScheduleCandidate], list[ActivityProposal]]:
        free = available_intervals(request)
        for existing in request.existing_schedules:
            start = time_offset(existing.start)
            free = self._subtract(free, start, start + timedelta(minutes=existing.duration_minutes))

        candidates = []
        unscheduled = []
        for activity in activities[: request.max_candidates]:
            duration = timedelta(minutes=activity.duration_minutes)
            start = None
            if activity.preferred_time is not None:
                preferred = time_offset(activity.preferred_time)
                start = next(
                    (
                        preferred
                        for left, right in free
                        if left <= preferred and preferred + duration <= right
                    ),
                    None,
                )
            if start is None:
                start = next((left for left, right in free if left + duration <= right), None)
            if start is None:
                unscheduled.append(activity)
                continue
            candidates.append(
                ScheduleCandidate(
                    plan_name=activity.plan_name,
                    content=activity.content,
                    scheduled_date=request.date,
                    scheduled_time=time(
                        hour=start.seconds // 3600,
                        minute=start.seconds // 60 % 60,
                        second=start.seconds % 60,
                        microsecond=start.microseconds,
                    ),
                    duration_minutes=activity.duration_minutes,
                )
            )
            free = self._subtract(free, start, start + duration)
        return candidates, unscheduled

    @staticmethod
    def _subtract(intervals, busy_start, busy_end):
        free = []
        for start, end in intervals:
            if busy_end <= start or busy_start >= end:
                free.append((start, end))
                continue
            if start < busy_start:
                free.append((start, busy_start))
            if busy_end < end:
                free.append((busy_end, end))
        return free
