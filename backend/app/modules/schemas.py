from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=3000)]
Score = Annotated[int, Field(ge=0, le=100)]


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Dimension(Model):
    skill: Text
    score: Score


class Evidence(Model):
    quote: Text
    feedback: Text


class Analysis(Model):
    score: Score
    skills: list[Text] = Field(max_length=30)
    strengths: list[Text] = Field(max_length=8)
    improvements: list[Text] = Field(max_length=8)
    structure: Text
    readability: Text
    missing_information: list[Text] = Field(max_length=8)
    evidence: list[Evidence] = Field(min_length=1, max_length=10)
    role_relevance: Text


class Question(Model):
    prompt: str = Field(min_length=1, max_length=1000)
    topic: str = Field(min_length=1, max_length=120)


class Questions(Model):
    questions: list[Question] = Field(min_length=4, max_length=4)


class Response(Model):
    message: Text
    follow_up: str | None = Field(max_length=1000)


class QuestionFeedback(Model):
    question_id: UUID
    score: Score
    feedback: Text


class Report(Model):
    overall: Score
    scores: list[Dimension] = Field(min_length=1, max_length=5)
    strengths: list[Text] = Field(max_length=8)
    improvements: list[Text] = Field(max_length=8)
    recommendations: list[Text] = Field(max_length=8)
    questions: list[QuestionFeedback] = Field(max_length=6)


class InterviewCreate(Model):
    role: str = Field(min_length=2, max_length=120)
    type: Literal['Technical', 'HR', 'Behavioral', 'Mixed']
    difficulty: Literal['Easy', 'Medium', 'Hard']
    duration: Literal[10, 15, 20, 30, 45, 60]
    mode: Literal['Text'] = 'Text'
    language: Literal['Java', 'Python', 'C++', 'JavaScript'] = 'JavaScript'
    resume_id: UUID | None = None


class AnswerInput(Model):
    question_id: UUID
    text: str = Field(min_length=10, max_length=2000)


class ProfileInput(Model):
    name: str = Field(min_length=2, max_length=60)
    role: str = Field(max_length=120)
    bio: str = Field(max_length=1000)
    notifications: bool = True
    reminders: bool = True
    default_type: Literal['Technical', 'HR', 'Behavioral', 'Mixed'] = 'Technical'
    default_mode: Literal['Text'] = 'Text'


class JobView(Model):
    model_config = ConfigDict(extra='ignore')
    id: UUID
    kind: str
    resource_id: UUID
    status: str
    error: str | None
    attempts: int
    created_at: datetime


class ResumeView(Model):
    id: UUID
    filename: str
    target_role: str
    status: str
    created_at: datetime
    analysis: Analysis | None


class QuestionView(Model):
    id: UUID
    position: int
    prompt: str
    topic: str
    answer: str | None
    response: Response | None


class InterviewView(Model):
    id: UUID
    config: InterviewCreate
    status: str
    created_at: datetime
    deadline: datetime | None
    questions: list[QuestionView]
    report: Report | None


class Capabilities(Model):
    plan: Literal['free', 'pro']
    resumes_remaining: int
    interviews_remaining: int
    coding: Literal[False] = False
    paid_checkout: Literal[False] = False


class Workspace(Model):
    profile: ProfileInput
    capabilities: Capabilities
    resumes: list[ResumeView]
    interviews: list[InterviewView]


class FileLink(Model):
    url: str


class ErrorDetail(Model):
    code: str
    message: str
    request_id: str


class ErrorResponse(Model):
    error: ErrorDetail
