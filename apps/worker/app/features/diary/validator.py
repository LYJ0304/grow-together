from .schemas import (
    DiaryGenerateRequest,
    DiaryGenerationResponse,
)


class DiaryValidationError(Exception):
    pass


class DiaryValidator:
    def validate(
        self,
        request: DiaryGenerateRequest,
        response: DiaryGenerationResponse,
    ) -> None:

        valid_ids = {
            activity.todo_id for activity in request.activities if activity.todo_id is not None
        }

        self._validate_source_ids(
            response.source_todo_ids,
            valid_ids,
        )

        for point in response.growth_points:
            self._validate_source_ids(
                point.source_todo_ids,
                valid_ids,
            )

    def _validate_source_ids(
        self,
        source_ids: list[int],
        valid_ids: set[int],
    ) -> None:

        if len(source_ids) != len(set(source_ids)):
            raise DiaryValidationError("Duplicate source IDs")

        if not set(source_ids).issubset(valid_ids):
            raise DiaryValidationError("Unknown source IDs")
