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
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

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

    private sealed interface Reservation {
        record Cached(ReportInsight insight) implements Reservation {}
        record Start(CompletableFuture<ReportInsight> flight) implements Reservation {}
        record Join(CompletableFuture<ReportInsight> flight) implements Reservation {}
        enum Busy implements Reservation { INSTANCE }
    }

    public WeeklyReportResponse get(Long owner, LocalDate week) {
        var snapshot = reader.read(owner, week);
        if (snapshot.restriction() != null) return snapshot.report();
        var cached = cachedInsight(key(owner, snapshot));
        return cached == null ? snapshot.report() : snapshot.with(cached);
    }

    public WeeklyReportResponse generate(Long owner, LocalDate week) {
        var before = reader.read(owner, week);
        if (before.restriction() != null) return before.report();
        var key = key(owner, before);
        return switch (reserve(key)) {
            case Reservation.Cached cached -> before.with(cached.insight());
            case Reservation.Busy ignored -> before.with(ReportInsight.of(ReportInsightState.UNAVAILABLE, "BUSY"));
            case Reservation.Start start -> latestResponse(owner, key, generateAndPublish(owner, before, key, start.flight()));
            case Reservation.Join join -> latestResponse(owner, key, awaitExisting(join.flight()));
        };
    }

    private ReportInsight cachedInsight(Key key) {
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null) return hit.insight();
            boolean stale = cache.keySet().stream()
                    .anyMatch(k -> k.owner().equals(key.owner()) && k.week().equals(key.week()));
            return stale ? ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED") : null;
        }
    }

    // Cache lookup, joining and ownership assignment share one atomic reservation boundary.
    private Reservation reserve(Key key) {
        synchronized (cache) {
            prune();
            var hit = cache.get(key);
            if (hit != null && hit.insight().state() == ReportInsightState.AVAILABLE)
                return new Reservation.Cached(hit.insight());
            var existing = flights.get(key);
            if (existing != null) return new Reservation.Join(existing);
            if (flights.size() >= IN_FLIGHT_CAPACITY) return Reservation.Busy.INSTANCE;
            var created = new CompletableFuture<ReportInsight>();
            flights.put(key, created);
            return new Reservation.Start(created);
        }
    }

    private ReportInsight generateAndPublish(Long owner, WeeklyReportReader.Snapshot before, Key key,
            CompletableFuture<ReportInsight> flight) {
        try {
            // No monitor spans a DB read or HTTP call; the reader ends its transaction before HTTP.
            var insight = refreshAndPublish(owner, key, flight, call(before.input()));
            flight.complete(insight);
            return insight;
        } catch (RuntimeException failure) {
            flight.completeExceptionally(failure);
            throw failure;
        } finally {
            synchronized (cache) {
                // Retirement can replace a slot while its old leader is still returning.
                flights.remove(key, flight);
            }
        }
    }

    private ReportInsight refreshAndPublish(Long owner, Key key, CompletableFuture<ReportInsight> flight,
            ReportInsight insight) {
        var latest = reader.read(owner, key.week());
        if (!latest.report().sourceHash().equals(key.hash()))
            return ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED");
        synchronized (cache) {
            prune();
            if (flights.get(key) == flight) cache.put(key, new Entry(insight, clock.instant()));
            while (cache.size() > CACHE_CAPACITY) cache.remove(cache.keySet().iterator().next());
        }
        return insight;
    }

    private ReportInsight awaitExisting(CompletableFuture<ReportInsight> flight) {
        try {
            return flight.get(40, TimeUnit.SECONDS);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            return ReportInsight.of(ReportInsightState.UNAVAILABLE, "WORKER_UNAVAILABLE");
        } catch (TimeoutException failure) {
            return ReportInsight.of(ReportInsightState.UNAVAILABLE, "TIMEOUT");
        } catch (ExecutionException failure) {
            return ReportInsight.of(ReportInsightState.UNAVAILABLE, "WORKER_UNAVAILABLE");
        }
    }

    private WeeklyReportResponse latestResponse(Long owner, Key key, ReportInsight insight) {
        var latest = reader.read(owner, key.week());
        return latest.with(latest.report().sourceHash().equals(key.hash())
                ? insight : ReportInsight.of(ReportInsightState.STALE, "SOURCE_CHANGED"));
    }

    @org.springframework.transaction.event.TransactionalEventListener
    public void accountWithdrawn(com.growtogether.user.AccountWithdrawn event) {
        synchronized (cache) {
            cache.keySet().removeIf(key -> key.owner().equals(event.owner()));
            flights.entrySet().removeIf(entry -> {
                if (!entry.getKey().owner().equals(event.owner())) return false;
                entry.getValue().completeExceptionally(new IllegalStateException("Account removed"));
                return true;
            });
        }
    }

    private ReportInsight call(ReportWorkerRequest input) {
        try {
            var output = worker.generate(input);
            return validation.valid(input, output)
                    ? new ReportInsight(ReportInsightState.AVAILABLE, null, output.result().external())
                    : ReportInsight.of(ReportInsightState.INVALID_RESULT, "INVALID_RESULT");
        } catch (ResponseStatusException ex) {
            var status = HttpStatus.resolve(ex.getStatusCode().value());
            if (status == null) throw ex;
            return switch (status) {
                case BAD_GATEWAY -> ReportInsight.of(ReportInsightState.INVALID_RESULT, "INVALID_RESULT");
                case SERVICE_UNAVAILABLE -> ReportInsight.of(ReportInsightState.UNAVAILABLE, "WORKER_UNAVAILABLE");
                case GATEWAY_TIMEOUT -> ReportInsight.of(ReportInsightState.UNAVAILABLE, "TIMEOUT");
                default -> throw ex;
            };
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
