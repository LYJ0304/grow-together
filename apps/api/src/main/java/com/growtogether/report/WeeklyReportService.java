package com.growtogether.report;

import static com.growtogether.report.ReportDtos.*;

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
    private record Entry(Insight insight, Instant created) {}
    private final Map<Key, Entry> cache = new LinkedHashMap<>(16, .75f, true);
    private final Map<Key, CompletableFuture<Insight>> flights = new HashMap<>();

    public WeeklyReport get(Long owner, LocalDate week) {
        var snapshot = reader.read(owner, week);
        if (snapshot.restriction() != null) return snapshot.report();
        var key = key(owner, snapshot);
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null) return snapshot.with(hit.insight());
            boolean stale = cache.keySet().stream()
                    .anyMatch(k -> k.owner().equals(owner) && k.week().equals(key.week()));
            return stale ? snapshot.with(Insight.of(State.STALE, "SOURCE_CHANGED")) : snapshot.report();
        }
    }

    public WeeklyReport generate(Long owner, LocalDate week) {
        var before = reader.read(owner, week);
        if (before.restriction() != null) return before.report();
        var key = key(owner, before);
        CompletableFuture<Insight> flight;
        boolean leader;
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null && hit.insight().state() == State.AVAILABLE) return before.with(hit.insight());
            flight = flights.get(key);
            leader = flight == null;
            if (leader) {
                if (flights.size() >= IN_FLIGHT_CAPACITY) return before.with(Insight.of(State.UNAVAILABLE, "BUSY"));
                flight = new CompletableFuture<>();
                flights.put(key, flight);
            }
        }

        Insight insight;
        if (leader) {
            try {
                // Reader transactions and the cache monitor end before the HTTP call.
                insight = call(before.input());
                var latest = reader.read(owner, before.report().period().start());
                if (!latest.report().sourceHash().equals(key.hash())) {
                    insight = Insight.of(State.STALE, "SOURCE_CHANGED");
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
                insight = Insight.of(State.UNAVAILABLE, "WORKER_UNAVAILABLE");
            } catch (TimeoutException ex) {
                insight = Insight.of(State.UNAVAILABLE, "TIMEOUT");
            } catch (ExecutionException ex) {
                insight = Insight.of(State.UNAVAILABLE, "WORKER_UNAVAILABLE");
            }
        }
        var latest = reader.read(owner, before.report().period().start());
        return latest.with(latest.report().sourceHash().equals(key.hash())
                ? insight : Insight.of(State.STALE, "SOURCE_CHANGED"));
    }

    private Insight call(WorkerRequest input) {
        try {
            var output = worker.generate(input);
            return validation.valid(input, output)
                    ? new Insight(State.AVAILABLE, null, output.result().external())
                    : Insight.of(State.INVALID_RESULT, "INVALID_RESULT");
        } catch (ReportGenerationException ex) {
            return Insight.of("INVALID_RESULT".equals(ex.reason())
                    ? State.INVALID_RESULT : State.UNAVAILABLE, ex.reason());
        }
    }

    private Key key(Long owner, WeeklyReportReader.Snapshot source) {
        return new Key(owner, source.report().period().start(), source.report().sourceHash(), PROMPT_VERSION);
    }

    // All cache/flight bookkeeping shares this monitor. Never hold it during DB/HTTP work.
    private void prune() {
        var now = clock.instant();
        cache.entrySet().removeIf(e -> !now.isBefore(e.getValue().created().plusSeconds(
                e.getValue().insight().state() == State.AVAILABLE ? 900 : 30)));
    }
}
