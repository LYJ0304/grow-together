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

    /*
     * TODO(refactor): 리뷰 합의에 따라 flag/분기 구조 개선은 후속 작업으로 미룬다.
     * https://github.com/LYJ0304/grow-together/pull/190#discussion_r4546615445
     *
     * 문제: cache hit, leader 여부, 대기, 생성, freshness 확인, 완료/실패 정리가 한 흐름에 섞여
     * 분기 사이의 순서와 자원 수명까지 함께 추적해야 한다. boolean 개수 자체가 개선 목표는 아니다.
     * leader는 호출자가 동작을 고르는 flag argument가 아닌 로컬 상태이므로, 이름만 enum으로
     * 바꾸거나 모든 boolean을 금지하지 말고 각 경로의 책임/불변식을 먼저 드러낸다.
     * 1. 예약 결정, 생성 담당 경로, 기존 요청 대기 경로, 결과 재검증/반영을 의도가 보이는 함수로
     *    추출한다. 예약 결과를 Cached/Join/Start/Busy처럼 데이터와 함께 표현하는 작은 결과 타입을
     *    검토해 future + leader의 조합을 여러 곳에서 재해석하지 않게 한다. 거대한 상태 머신이나
     *    Strategy 상속 계층을 미리 도입할 필요는 없다.
     * 2. cache 확인과 in-flight 조회/등록/용량 판정은 같은 임계 구역의 원자적 예약으로 유지한다.
     *    보조 객체로 옮기더라도 잠금을 나눠 같은 key의 생성 담당자가 둘이 되는 일을 막아야 한다.
     *    DB/HTTP 호출과 future 대기는 모니터 밖에 두고, 완료/예외 전파와 finally의 등록 해제를
     *    경로별로 검토한다. 기존 대기 deadline과 interrupt 복원 동작을 유지한다.
     * 3. user/week/sourceHash/promptVersion key, LRU 128개, 성공 15분/실패 30초 TTL,
     *    동시 key 16개와 BUSY/재시도 정책을 보존한다. GET이 Worker를 호출하게 만들지 않는다.
     *    생성 후 캐시 반영 전과 반환 전의 원본 재검증은 단순 중복으로 보고 제거하지 않는다.
     *    STALE 결과는 게시하지 않고, Worker 실패에도 통계/기억과 기존 인사이트 상태를 유지한다.
     * 완료 검증: Service 테스트의 같은 key 단일 호출/다른 owner 격리/TTL·용량·실패 재시도와
     * 예약 해제·대기 timeout/interrupt 경로를 먼저 보강한다. Integration/Postgres 테스트로
     * 생성 중 원본 수정·삭제 후 낡은 결과가 노출되지 않는지 확인한 뒤 작은 단계로 추출한다.
     * 분기별 책임을 독립적으로 설명·검증할 수 있게 되면 이 TODO를 제거한다.
     * 아래 자료는 분리 기준의 참고 자료이며 로컬 boolean 자체를 오류로 규정하는 근거가 아니다.
     * Extract Function: https://refactoring.com/catalog/extractFunction.html
     * Flag Argument (적용 범위/예외): https://martinfowler.com/bliki/FlagArgument.html
     */
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
