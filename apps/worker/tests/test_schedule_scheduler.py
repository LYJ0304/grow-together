from datetime import time

from app.features.schedule.schemas import ActivityProposal, ExistingSchedule, TimeWindow


def test_first_fit_subtracts_busy_intervals_and_keeps_unplaced_activities(schedule_request):
    from app.features.schedule.scheduler import ScheduleScheduler

    schedule_request.existing_schedules = [
        ExistingSchedule(todo_id=1, plan_name="식사", start="13:00", duration_minutes=61),
        ExistingSchedule(todo_id=2, plan_name="약속", start="14:30", duration_minutes=30),
    ]
    before = schedule_request.model_dump()
    activities = [
        ActivityProposal(plan_name=name, duration_minutes=duration)
        for name, duration in [("독서", 29), ("놀이", 60), ("외출", 61), ("휴식", 30)]
    ]
    candidates, unscheduled = ScheduleScheduler().schedule(schedule_request, activities)
    assert [(c.plan_name, c.scheduled_time) for c in candidates] == [
        ("독서", time(14, 1)),
        ("놀이", time(15)),
        ("휴식", time(16)),
    ]
    assert unscheduled == [activities[2]]
    assert schedule_request.model_dump() == before


def test_merges_unsorted_overlapping_windows_and_subtracts_overlapping_busy(schedule_request):
    from app.features.schedule.scheduler import ScheduleScheduler

    schedule_request.available_windows = [
        TimeWindow(start="14:00", end="16:00"),
        TimeWindow(start="13:00", end="15:00"),
    ]
    schedule_request.existing_schedules = [
        ExistingSchedule(todo_id=1, plan_name="A", start="12:00", duration_minutes=90),
        ExistingSchedule(todo_id=2, plan_name="B", start="13:00", duration_minutes=60),
    ]
    candidates, unscheduled = ScheduleScheduler().schedule(
        schedule_request, [ActivityProposal(plan_name="놀이", duration_minutes=120)]
    )
    assert candidates[0].scheduled_time == time(14)
    assert unscheduled == []


def test_preferred_time_is_soft_and_unavailable_time_falls_back(schedule_request):
    from app.features.schedule.scheduler import ScheduleScheduler

    activities = [
        ActivityProposal(plan_name="독서", duration_minutes=30, preferred_time="15:17"),
        ActivityProposal(plan_name="놀이", duration_minutes=60, preferred_time="16:30"),
    ]
    candidates, _ = ScheduleScheduler().schedule(schedule_request, activities)
    assert [c.scheduled_time for c in candidates] == [time(15, 17), time(13)]


def test_does_not_bridge_a_gap_or_exceed_limit(schedule_request):
    from app.features.schedule.scheduler import ScheduleScheduler

    schedule_request.available_windows = [
        TimeWindow(start="13:00", end="13:30"),
        TimeWindow(start="14:00", end="14:30"),
    ]
    schedule_request.max_candidates = 1
    activities = [
        ActivityProposal(plan_name="놀이", duration_minutes=31),
        ActivityProposal(plan_name="독서", duration_minutes=15),
    ]
    candidates, unscheduled = ScheduleScheduler().schedule(schedule_request, activities)
    assert candidates == []
    assert unscheduled == activities[:1]


def test_fully_occupied_window_returns_all_proposals_unscheduled(schedule_request) -> None:
    from app.features.schedule.scheduler import ScheduleScheduler

    schedule_request.existing_schedules = [
        ExistingSchedule(todo_id=1, plan_name="외출", start="12:00", duration_minutes=360)
    ]
    activities = [ActivityProposal(plan_name="독서", duration_minutes=1)]
    candidates, unscheduled = ScheduleScheduler().schedule(schedule_request, activities)
    assert candidates == []
    assert unscheduled == activities
