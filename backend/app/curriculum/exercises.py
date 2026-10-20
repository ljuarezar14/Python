"""Exercise check definitions shared by storage, seeding and the public API.

The checks run in the student's browser, so they are public by design: they give
formative feedback and are not evidence for high-integrity credentials.
"""

import json
import keyword
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    TypeAdapter,
    field_validator,
    model_validator,
)

MAX_CHECKS = 20
MAX_EXPECTED_STDOUT = 10_000
MAX_CHECK_JSON = 10_000
CHECK_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"


class OutputCheck(BaseModel):
    """Run the program with optional input lines and compare what it prints."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["output"]
    id: str = Field(pattern=CHECK_ID_PATTERN)
    description: str = Field(min_length=1, max_length=300)
    stdin: list[Annotated[str, Field(max_length=1_000)]] = Field(
        default_factory=list, max_length=50
    )
    expected_stdout: str = Field(max_length=MAX_EXPECTED_STDOUT)

    @field_validator("stdin")
    @classmethod
    def single_line_inputs(cls, lines: list[str]) -> list[str]:
        if any("\n" in line or "\r" in line for line in lines):
            raise ValueError("cada entrada debe ser una sola línea")
        return lines


class FunctionCheck(BaseModel):
    """Run the program, call one of its functions and compare the returned value."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["function"]
    id: str = Field(pattern=CHECK_ID_PATTERN)
    description: str = Field(min_length=1, max_length=300)
    function_name: str = Field(min_length=1, max_length=64)
    args: list[JsonValue] = Field(default_factory=list, max_length=10)
    expected: JsonValue

    @field_validator("function_name")
    @classmethod
    def python_identifier(cls, name: str) -> str:
        if not name.isidentifier() or keyword.iskeyword(name):
            raise ValueError("debe ser un nombre de función válido en Python")
        return name

    @model_validator(mode="after")
    def bounded_size(self) -> "FunctionCheck":
        # allow_nan=False rechaza NaN e infinito, que no son JSON válido para el navegador.
        try:
            serialized = json.dumps(
                {"args": self.args, "expected": self.expected},
                ensure_ascii=False,
                allow_nan=False,
            )
        except ValueError:
            raise ValueError("los valores deben ser JSON estándar, sin NaN ni infinito") from None
        size = len(serialized)
        if size > MAX_CHECK_JSON:
            raise ValueError("los argumentos y el resultado esperado son demasiado grandes")
        return self


ExerciseCheck = Annotated[OutputCheck | FunctionCheck, Field(discriminator="kind")]
_checks_adapter = TypeAdapter(
    Annotated[list[ExerciseCheck], Field(min_length=1, max_length=MAX_CHECKS)]
)


def validate_checks(raw: object) -> list[OutputCheck | FunctionCheck]:
    """Return typed checks or raise pydantic.ValidationError / ValueError."""
    checks = _checks_adapter.validate_python(raw)
    ids = [check.id for check in checks]
    if len(ids) != len(set(ids)):
        raise ValueError("cada prueba necesita un identificador único dentro del ejercicio")
    return checks
