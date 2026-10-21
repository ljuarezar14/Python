"""Exercise progress payloads; results are reported by the browser and not verified."""

from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.curriculum.exercises import MAX_CHECKS

# Same limit the browser applies before running code.
MAX_CODE_CHARS = 100_000


class AttemptIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exercise_version: int = Field(ge=1)
    code: str = Field(max_length=MAX_CODE_CHARS)
    status: Literal["passed", "failed", "timeout"]
    passed_count: int = Field(ge=0, le=MAX_CHECKS)
    total_count: int = Field(ge=1, le=MAX_CHECKS)

    @model_validator(mode="after")
    def counts_match_status(self) -> Self:
        if self.passed_count > self.total_count:
            raise ValueError("passed_count no puede superar total_count")
        if (self.status == "passed") != (self.passed_count == self.total_count):
            raise ValueError("status no coincide con el número de pruebas correctas")
        return self


class ExerciseProgressOut(BaseModel):
    exercise_id: str
    exercise_version: int
    current_version: int
    outdated: bool
    code: str
    status: str
    passed_count: int
    total_count: int
    attempts: int
    solved: bool
    solved_at: datetime | None
    updated_at: datetime


class ProgressItem(BaseModel):
    exercise_id: str
    lesson_id: str
    title: str
    outdated: bool
    status: str
    passed_count: int
    total_count: int
    solved: bool
    updated_at: datetime


class ProgressSummary(BaseModel):
    solved_count: int
    items: list[ProgressItem]
