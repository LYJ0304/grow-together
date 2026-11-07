from datetime import timedelta

from .scheduler import available_intervals, time_offset
from .schemas import ScheduleGenerationRequest, ScheduleGenerationResponse


class ScheduleValidationError(Exception):
    pass


class ScheduleValidator:
    def validate(
        self,
        request: ScheduleGenerationRequest,
        result: ScheduleGenerationResponse,
    ) -> None:
        if result.date != request.date:
            raise ScheduleValidationError("Schedule date mismatch")
        if len(result.candidates) + len(result.unscheduled) > request.max_candidates:
            raise ScheduleValidationError("Too many activities")

        names = [
            " ".join(activity.plan_name.split()).casefold()
            for activity in [*result.candidates, *result.unscheduled]
        ]
        if len(names) != len(set(names)):
            raise ScheduleValidationError("Duplicate activities")

        windows = available_intervals(request)
        occupied = [
            (
                time_offset(existing.start),
                time_offset(existing.start) + timedelta(minutes=existing.duration_minutes),
            )
            for existing in request.existing_schedules
        ]
        for candidate in result.candidates:
            if candidate.scheduled_date != request.date:
                raise ScheduleValidationError("Candidate date mismatch")
            start = time_offset(candidate.scheduled_time)
            end = start + timedelta(minutes=candidate.duration_minutes)
            if not any(left <= start and end <= right for left, right in windows):
                raise ScheduleValidationError("Candidate outside available windows")
            if any(start < busy_end and end > busy_start for busy_start, busy_end in occupied):
                raise ScheduleValidationError("Schedule conflict")
            occupied.append((start, end))
