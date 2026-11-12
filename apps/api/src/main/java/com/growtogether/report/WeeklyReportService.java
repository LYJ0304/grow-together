package com.growtogether.report;

import com.growtogether.report.dto.ReportInsight;
import com.growtogether.report.dto.ReportInsightState;
import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.WeeklyReportResponse;
import static com.growtogether.report.dto.ReportWorkerRequest.PROMPT_VERSION;


import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WeeklyReportService {
    private static final int CACHE_CAPACITY = 128;
    private static final int IN_FLIGHT_CAPACITY = 16;
    private final WeeklyReportReader reader;
    private final ReportWorkerClient worker;
    private final ReportResultValidator validation;
    private final Clock clock;

    private record Key(Long owner, LocalDate week, String hash, String promptVersion) {}
    private record Entry(ReportInsight insight, Instant created) {}
    private final Map<Key, Entry> cache = new LinkedHashMap<>(16, .75f, true);
    private final Map<Key, CompletableFuture<ReportInsight>> flights = new HashMap<>();

    public WeeklyReportResponse get(Long owner, LocalDate week) {
        var snapshot = reader.read(owner, week);
        if (snapshot.restriction() != null) return snapshot.report();
        var key = key(owner, snapshot);
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null) return snapshot.with(hit.insight());
            boolean stale = cache.keySet().stream()
                    .anyMatch(k -> k.owner().equals(owner) && k.week().equals(key.week()));
            return stale ? snapshot.with(ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED")) : snapshot.report();
        }
    }

    public WeeklyReportResponse generate(Long owner, LocalDate week) {
        var before = reader.read(owner, week);
        if (before.restriction() != null) return before.report();
        var key = key(owner, before);
        CompletableFuture<ReportInsight> flight;
        boolean leader;
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null && hit.insight().state() == ReportInsightState.AVAILABLE) return before.with(hit.insight());
            flight = flights.get(key);
            leader = flight == null;
            if (leader) {
                if (flights.size() >= IN_FLIGHT_CAPACITY) return before.with(ReportInsight.of(ReportInsightState.UNAVAILABLE, "BUSY"));
                flight = new CompletableFuture<>();
                flights.put(key, flight);
            }
        }

        ReportInsight insight;
        if (leader) {
            try {
                // Reader transactions and the cache monitor end before the HTTP call.
                insight = call(before.input());
                var latest = reader.read(owner, before.report().period().start());
                if (!latest.report().sourceHash().equals(key.hash())) {
                    insight = ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED");
                } else {
                    synchronized (cache) {
                        prune();
                        cache.put(key, new Entry(insight, clock.instant()));
                        while (cache.size() > CACHE_CAPACITY) cache.remove(cache.keySet().iterator().next());
                    }
                }
                flight.complete(insight);
            } catch (RuntimeException ex) {
                flight.completeExceptionally(ex);
                throw ex;
            } finally {
                synchronized (cache) {
                    flights.remove(key);
                }
            }
        } else {
            try {
                insight = flight.get(40, TimeUnit.SECONDS);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                insight = ReportInsight.of(ReportInsightState.UNAVAILABLE, "WORKER_UNAVAILABLE");
            } catch (TimeoutException ex) {
                insight = ReportInsight.of(ReportInsightState.UNAVAILABLE, "TIMEOUT");
            } catch (ExecutionException ex) {
                insight = ReportInsight.of(ReportInsightState.UNAVAILABLE, "WORKER_UNAVAILABLE");
            }
        }
        var latest = reader.read(owner, before.report().period().start());
        return latest.with(latest.report().sourceHash().equals(key.hash())
                ? insight : ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED"));
    }

    private ReportInsight call(ReportWorkerRequest input) {
        try {
            var output = worker.generate(input);
            return validation.valid(input, output)
                    ? new ReportInsight(ReportInsightState.AVAILABLE, null, output.result().external())
                    : ReportInsight.of(ReportInsightState.INVALID_RESULT, "INVALID_RESULT");
        } catch (ReportGenerationException ex) {
            return ReportInsight.of("INVALID_RESULT".equals(ex.reason())
                    ? ReportInsightState.INVALID_RESULT : ReportInsightState.UNAVAILABLE, ex.reason());
        }
    }

    private Key key(Long owner, WeeklyReportReader.Snapshot source) {
        return new Key(owner, source.report().period().start(), source.report().sourceHash(), PROMPT_VERSION);
    }

    // All cache/flight bookkeeping shares this monitor. Never hold it during DB/HTTP work.
    private void prune() {
        var now = clock.instant();
        cache.entrySet().removeIf(e -> !now.isBefore(e.getValue().created().plusSeconds(
                e.getValue().insight().state() == ReportInsightState.AVAILABLE ? 900 : 30)));
    }
}
