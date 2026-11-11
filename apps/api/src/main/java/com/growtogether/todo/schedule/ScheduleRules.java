package com.growtogether.todo.schedule;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static com.growtogether.todo.schedule.ScheduleDtos.*;

final class ScheduleRules {
    private ScheduleRules() {}
    static void validate(List<Candidate> candidates, List<Unscheduled> unscheduled,
            Context context, List<Window> windows, int limit, HttpStatus status) {
        if (candidates.size() + unscheduled.size() > limit || candidates.size() + unscheduled.size() == 0)
            fail(status);
        var names = new HashSet<String>();
        int total = 0;
        for (var c : candidates) {
            if (!names.add(c.planName().trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT))) fail(status);
            total += c.durationMinutes();
        }
        for (var c : unscheduled) {
            if (!names.add(c.planName().trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT))) fail(status);
            total += c.durationMinutes();
        }
        if (context.budget() != null && total > context.budget()) fail(status);
        var occupied = new ArrayList<long[]>();
        for (var item : context.existing()) occupied.add(interval(item.start(), item.durationMinutes(), status));
        for (var item : candidates) {
            long[] interval = interval(item.scheduledTime(), item.durationMinutes(), status);
            if (windows != null && !insideWindows(interval, windows)) fail(status);
            if (occupied.stream().anyMatch(b -> interval[0] < b[1] && interval[1] > b[0])) fail(status);
            occupied.add(interval);
        }
    }
    private static boolean insideWindows(long[] interval, List<Window> windows) {
        // Match worker's merging of overlapping or touching windows.
        var sorted = windows.stream().sorted(java.util.Comparator.comparing(Window::start)).toList();
        long left = -1, right = -1;
        for (var window : sorted) {
            long start = window.start().toNanoOfDay(), end = window.end().toNanoOfDay();
            if (start <= right) right = Math.max(right, end);
            else { if (left <= interval[0] && interval[1] <= right) return true; left = start; right = end; }
        }
        return left <= interval[0] && interval[1] <= right;
    }
    private static long[] interval(java.time.LocalTime start, int minutes, HttpStatus status) {
        long begin = start.toNanoOfDay(), end = begin + minutes * 60_000_000_000L;
        if (minutes < 1 || minutes > 1440 || end > 86_400_000_000_000L) fail(status);
        return new long[]{begin, end};
    }
    private static void fail(HttpStatus status) {
        throw new ResponseStatusException(status, status == HttpStatus.CONFLICT
                ? "일정이나 개인화 설정이 변경되었어요. 목록을 확인하고 다시 생성해주세요."
                : "일정 생성 결과가 시간·개수·개인화 조건에 맞지 않아요.");
    }
}
