"""Public, read-only curriculum response contracts."""

from pydantic import BaseModel, ConfigDict


class PathSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    version: int


class PathPage(BaseModel):
    items: list[PathSummary]
    total: int
    limit: int
    offset: int


class ModuleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    path_id: str
    position: int
    level: str
    title: str
    description: str
    objectives: list[str]
    version: int


class PathDetail(PathSummary):
    modules: list[ModuleSummary]


class LessonSummary(BaseModel):
    id: str
    module_id: str
    position: int
    title: str
    summary: str
    objectives: list[str]
    prerequisite_ids: list[str]
    version: int


class ModuleDetail(ModuleSummary):
    lessons: list[LessonSummary]


class LessonDetail(LessonSummary):
    content_markdown: str
