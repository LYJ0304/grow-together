package com.growtogether.report;

import static org.assertj.core.api.Assertions.*;
import static com.growtogether.report.ReportDtos.*;
import static com.growtogether.report.ReportTestData.*;
import jakarta.validation.Validation;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ReportResultValidatorTest {
    final ReportResultValidator validator=new ReportResultValidator(Validation.buildDefaultValidatorFactory().getValidator());
    final WorkerRequest input=snapshot("a".repeat(64)).input();
    @Test void acceptsOnlyCurrentTransmittedEvidenceAndExactObservationQuote() {
        var valid=result(input);assertThat(validator.valid(input,valid)).isTrue();
        var evidence=List.of(new Evidence(EvidenceType.DIARY,10L));
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult(valid.result().summary(),List.of(new Observation("그림책 읽기",evidence)),valid.result().nextSteps())))).isFalse();
        evidence=List.of(new Evidence(EvidenceType.TODO,999L));
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult(valid.result().summary(),List.of(new Observation("그림책 읽기",evidence)),valid.result().nextSteps())))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse("b".repeat(64),PROMPT_VERSION,valid.result()))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),"old",valid.result()))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult(valid.result().summary(),List.of(new Observation("근거에 없는 설명",valid.result().observations().getFirst().evidence())),valid.result().nextSteps())))).isFalse();
    }
    @ParameterizedTest @ValueSource(strings={"3회 완료했어요","발달 지연이 없어요","또래보다 우수해요","행복해졌어요","A developmental assessment"," ","１２회"})
    void rejectsQuantityMedicalComparisonInferenceAndBlank(String text) {
        var valid=result(input);
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult(text,valid.result().observations(),valid.result().nextSteps())))).isFalse();
    }
    @Test void rejectsMissingOversizedAndUnboundedArrays() {
        assertThat(validator.valid(input,null)).isFalse();
        var valid=result(input);
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,null))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult("a".repeat(501),valid.result().observations(),valid.result().nextSteps())))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult("요약",List.of(),valid.result().nextSteps())))).isFalse();
        assertThat(validator.valid(input,new WorkerResponse(input.sourceHash(),PROMPT_VERSION,
                new WorkerResult("요약",valid.result().observations(),java.util.Collections.nCopies(3,valid.result().nextSteps().getFirst()))))).isFalse();
    }
}
