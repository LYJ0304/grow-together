package com.growtogether.report;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.growtogether.report.ReportDtos.*;
import static com.growtogether.report.ReportTestData.*;
import jakarta.validation.Validation;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;

class WeeklyReportServiceTest {
    final WeeklyReportReader reader=mock(WeeklyReportReader.class);
    final ReportWorkerClient worker=mock(ReportWorkerClient.class);
    final Clock clock=mock(Clock.class);
    final WeeklyReportReader.Snapshot source=snapshot("a".repeat(64));
    final WeeklyReportService service=new WeeklyReportService(reader,worker,
            new ReportResultValidator(Validation.buildDefaultValidatorFactory().getValidator()),clock);
    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(NOW);
        when(reader.read(anyLong(),any())).thenReturn(source);
        when(worker.generate(any())).thenAnswer(i->result(i.getArgument(0)));
    }
    @Test void getNeverGeneratesAndPostReusesOnlyFreshSuccessfulResult() {
        assertThat(service.get(1L,WEEK).insight().state()).isEqualTo(State.NOT_GENERATED);
        verifyNoInteractions(worker);
        assertThat(service.generate(1L,WEEK).insight().state()).isEqualTo(State.AVAILABLE);
        assertThat(service.generate(1L,WEEK).insight().state()).isEqualTo(State.AVAILABLE);
        verify(worker,times(1)).generate(any());
        when(clock.instant()).thenReturn(NOW.plusSeconds(901));
        assertThat(service.get(1L,WEEK).insight().state()).isEqualTo(State.NOT_GENERATED);
        service.generate(1L,WEEK); verify(worker,times(2)).generate(any());
    }
    @Test void failuresRemainSeparateFromAggregatesAndExplicitRetryWorks() {
        doThrow(new ReportGenerationException("TIMEOUT")).doAnswer(i->result(i.getArgument(0))).when(worker).generate(any());
        var failed=service.generate(1L,WEEK);
        assertThat(failed.insight().state()).isEqualTo(State.UNAVAILABLE);
        assertThat(failed.insight().reason()).isEqualTo("TIMEOUT");
        assertThat(failed.metrics().completed()).isEqualTo(1);
        assertThat(service.get(1L,WEEK).insight().state()).isEqualTo(State.UNAVAILABLE);
        assertThat(service.generate(1L,WEEK).insight().state()).isEqualTo(State.AVAILABLE);
    }
    @Test void sourceChangedDuringGenerationIsNeverPublished() {
        var current=new AtomicReference<>(source);
        when(reader.read(anyLong(),any())).thenAnswer(i->current.get());
        doAnswer(i->{current.set(snapshot("b".repeat(64)));return result(i.getArgument(0));}).when(worker).generate(any());
        var stale=service.generate(1L,WEEK);
        assertThat(stale.insight().state()).isEqualTo(State.STALE); assertThat(stale.insight().result()).isNull();
        assertThat(stale.sourceHash()).isEqualTo("b".repeat(64));
        assertThat(service.get(1L,WEEK).insight().state()).isEqualTo(State.NOT_GENERATED);
    }
    @Test void concurrentSameKeySharesOneCall() throws Exception {
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        doAnswer(i->{entered.countDown();assertThat(release.await(5,TimeUnit.SECONDS)).isTrue();return result(i.getArgument(0));}).when(worker).generate(any());
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var first=pool.submit(()->service.generate(1L,WEEK));
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(()->service.generate(1L,WEEK));
            verify(reader,timeout(3000).atLeast(2)).read(1L,WEEK);
            release.countDown();
            assertThat(first.get(5,TimeUnit.SECONDS).insight().state()).isEqualTo(State.AVAILABLE);
            assertThat(second.get(5,TimeUnit.SECONDS).insight().state()).isEqualTo(State.AVAILABLE);
            verify(worker,times(1)).generate(any());
        } finally { release.countDown(); }
    }
    @Test void cacheEvictsOldEntriesAndNeverCrossesOwnerKeys() {
        for(long owner=1;owner<=129;owner++)service.generate(owner,WEEK);
        assertThat(service.get(1L,WEEK).insight().state()).isEqualTo(State.NOT_GENERATED);
        assertThat(service.get(129L,WEEK).insight().state()).isEqualTo(State.AVAILABLE);
        assertThat(service.get(130L,WEEK).insight().state()).isEqualTo(State.NOT_GENERATED);
    }
    @Test void inFlightKeysAreBounded() throws Exception {
        var entered=new CountDownLatch(16);var release=new CountDownLatch(1);
        doAnswer(i->{entered.countDown();assertThat(release.await(10,TimeUnit.SECONDS)).isTrue();return result(i.getArgument(0));}).when(worker).generate(any());
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            for(long owner=1;owner<=16;owner++){long id=owner;pool.submit(()->service.generate(id,WEEK));}
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            assertThat(service.generate(17L,WEEK).insight().reason()).isEqualTo("BUSY");
            release.countDown();
        } finally { release.countDown(); }
        verify(worker,times(16)).generate(any());
    }
}
