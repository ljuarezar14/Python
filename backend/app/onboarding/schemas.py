"""Versioned questionnaire input and response contracts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Goal = Literal["explore", "build", "automate", "innovate"]
Experience = Literal["none", "some", "comfortable"]
Interest = Literal["finance", "education", "work", "data", "environment", "web"]
ExampleContext = Literal["daily", "academic", "work", "community"]
KnownTopic = Literal["variables", "conditionals", "functions"]
WeeklyMinutes = Literal[15, 30, 60, 120, 180]


class OnboardingAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal: Goal
    experience: Experience
    weekly_minutes: WeeklyMinutes
    interests: list[Interest] = Field(min_length=1, max_length=3)
    example_context: ExampleContext
    known_topics: list[KnownTopic] = Field(max_length=3)

    @field_validator("interests", "known_topics")
    @classmethod
    def no_duplicates(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("No repitas opciones")
        return values


class Recommendation(BaseModel):
    starting_point: str
    focus: str
    suggested_theme: str
    reason: str
    weekly_plan: str
    example_project: str
    rule_version: int


class OnboardingResponse(OnboardingAnswers):
    recommendation: Recommendation
