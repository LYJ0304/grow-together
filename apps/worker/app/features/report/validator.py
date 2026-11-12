"""Conservative weekly-v1 policy, mirrored by the API's independent validator."""

import re
import unicodedata

from .schemas import ReportRequest, ReportResponse

VALIDATION_VERSION = "weekly-validation-v1"
UNSAFE = re.compile(
    r"진단|치료|발달\s*(지연|평가|정상|우수|수준)|정상\s*발달|또래|다른\s*(아이|부모)|"
    r"자폐|장애|성향|성격|지능|천재|우울|불안|행복해|즐거워|기뻐|느꼈|느끼|건강하|안정\s*애착|"
    r"diagnos|therap|developmental|normal development|autis|adhd|intelligen|personality|"
    r"happier|anxious|healthy child",
    re.IGNORECASE,
)


class ReportValidationError(Exception):
    pass


class ReportValidator:
    def validate(self, request: ReportRequest, response: ReportResponse) -> None:
        if (
            request.source_hash != response.source_hash
            or request.prompt_version != response.prompt_version
        ):
            raise ReportValidationError("Report identity mismatch")
        sources = {("TODO", todo.id): todo.title for todo in request.sources.todos}
        sources.update({("DIARY", diary.id): diary.excerpt for diary in request.sources.diaries})
        result = response.result
        texts = [result.summary]
        for item in [*result.observations, *result.next_steps]:
            keys = [(e.type, e.id) for e in item.evidence]
            if len(set(keys)) != len(keys) or any(key not in sources for key in keys):
                raise ReportValidationError("Invalid report evidence")
        for observation in result.observations:
            if not any(observation.text == sources[(e.type, e.id)] for e in observation.evidence):
                raise ReportValidationError("Observation must quote a cited source")
            texts.append(observation.text)
        for step in result.next_steps:
            texts.extend([step.title, step.description, step.reason])
        if any(
            UNSAFE.search(text) or any(unicodedata.category(c).startswith("N") for c in text)
            for text in texts
        ):
            raise ReportValidationError("Unsafe or quantitative report text")
