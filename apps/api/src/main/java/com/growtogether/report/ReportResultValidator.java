package com.growtogether.report;

import com.growtogether.report.dto.ReportEvidence;
import com.growtogether.report.dto.ReportEvidenceType;
import com.growtogether.report.dto.ReportWorkerRequest;
import com.growtogether.report.dto.ReportWorkerResponse;
import static com.growtogether.report.dto.ReportWorkerRequest.PROMPT_VERSION;

import jakarta.validation.Validator;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
class ReportResultValidator {
    private final Validator validator;
    // Conservative checks complement the Worker policy; they are not a semantic proof.
    private static final Pattern UNSAFE = Pattern.compile(
            "[\\p{N}]|진단|치료|발달\\s*(지연|평가|정상|우수|수준)|정상\\s*발달|또래|다른\\s*(아이|부모)|"
            + "자폐|장애|성향|성격|지능|천재|우울|불안|행복해|즐거워|기뻐|느꼈|느끼|건강하|안정\\s*애착|"
            + "diagnos|therap|developmental|normal development|autis|adhd|intelligen|personality|happier|anxious|healthy child",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    boolean valid(ReportWorkerRequest input, ReportWorkerResponse output) {
        if (output == null || !validator.validate(output).isEmpty()
                || !input.sourceHash().equals(output.sourceHash()) || !PROMPT_VERSION.equals(output.promptVersion())) return false;
        Map<ReportEvidence,String> sources = new HashMap<>();
        input.sources().todos().forEach(t -> sources.put(new ReportEvidence(ReportEvidenceType.TODO,t.id()),t.title()));
        input.sources().diaries().forEach(d -> sources.put(new ReportEvidence(ReportEvidenceType.DIARY,d.id()),d.excerpt()));
        var result=output.result();
        if (unsafe(result.summary())) return false;
        for (var observation: result.observations()) {
            if (unsafe(observation.text()) || !evidenceValid(observation.evidence(),sources)
                    || observation.evidence().stream().noneMatch(e -> observation.text().equals(sources.get(e)))) return false;
        }
        return result.nextSteps().stream().allMatch(step -> !unsafe(step.title()) && !unsafe(step.description())
                && !unsafe(step.reason()) && evidenceValid(step.evidence(),sources));
    }
    private boolean unsafe(String text) { return UNSAFE.matcher(text).find(); }
    private boolean evidenceValid(List<ReportEvidence> evidence, Map<ReportEvidence,String> sources) {
        return evidence.stream().distinct().count()==evidence.size() && sources.keySet().containsAll(evidence);
    }
}
