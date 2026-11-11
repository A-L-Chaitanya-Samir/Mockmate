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


class QuestionRubric(Model):
    correctness_relevance: Score
    reasoning_evidence: Score
    clarity_structure: Score


class QuestionMark(Model):
    question_id: UUID
    rubric: QuestionRubric
    evidence: str | None = Field(max_length=600)
    feedback: str = Field(min_length=1, max_length=1200)


class InterviewEvaluation(Model):
    questions: list[QuestionMark] = Field(min_length=1, max_length=6)
    strengths: list[Text] = Field(max_length=4)
    improvements: list[Text] = Field(max_length=4)
    recommendations: list[Text] = Field(max_length=4)


class QuestionFeedback(Model):
    question_id: UUID
    score: Score
    feedback: Text
    rubric: QuestionRubric | None = None
    evidence: str | None = None


class Report(Model):
    overall: Score
    scores: list[Dimension] = Field(min_length=1, max_length=5)
    strengths: list[Text] = Field(max_length=8)
    improvements: list[Text] = Field(max_length=8)
    recommendations: list[Text] = Field(max_length=8)
    questions: list[QuestionFeedback] = Field(max_length=6)
    rubric_version: str = 'text-v1'
    answered: int | None = None
    total_questions: int | None = None


class InterviewCreate(Model):
    seniority: Literal['Intern', 'Junior', 'Mid-level', 'Senior'] = 'Mid-level'
    role: str = Field(min_length=2, max_length=120)
    type: Literal['Technical', 'HR', 'Behavioral', 'Mixed']
    difficulty: Literal['Easy', 'Medium', 'Hard']
    duration: Literal[10, 15, 20, 30, 45, 60]
    mode: Literal['Text', 'Spoken'] = 'Spoken'
    language: Literal['Java', 'Python', 'C++', 'JavaScript'] = 'JavaScript'
    resume_id: UUID | None = None


class AnswerInput(Model):
    question_id: UUID
    text: str = Field(min_length=10, max_length=2000)
    transcription_id: UUID | None = None


class DeviceCheck(Model):
    camera: Literal[True]
    microphone: Literal[True]
    detector: Literal[True]
    audio_test: Literal[True]
    consent: Literal[True]
    phone_vision: bool = False


class VisionConsent(Model):
    enabled: bool


class PhoneFinding(Model):
    phone_visibility: Literal['visible', 'not_visible', 'uncertain']


class VisionCheckView(Model):
    id: UUID
    status: Literal['processing', 'completed', 'unavailable']
    result: Literal['visible', 'not_visible', 'uncertain'] | None
    model: str
    observed_at: datetime
    received_at: datetime
    checked_at: datetime | None
    error_code: str | None
    episode_id: UUID | None
    phase: Literal['start', 'recovered'] | None


class VisionState(Model):
    available: bool
    enabled: bool
    model: str
    interval_seconds: int
    audit_seconds: int
    checks: int
    limit: int
    retry_after: int
    warning_active: bool
    latest: VisionCheckView | None


class VisionSummary(Model):
    provider: Literal['Groq'] = 'Groq'
    model: str
    consented: bool
    checks: int
    unavailable: int
    uncertain: int
    visible: int
    episodes: int
    samples: list[VisionCheckView]


ObservationKind = Literal['no_face', 'multiple_faces', 'camera_unavailable', 'microphone_unavailable',
    'tab_hidden', 'focus_lost', 'detection_unavailable', 'coverage_gap']


class ObservationInput(Model):
    id: UUID
    episode_id: UUID
    kind: ObservationKind
    phase: Literal['start', 'recovered']
    observed_at: datetime
    duration_ms: int | None = Field(default=None, ge=0, le=86400000)


class ObservationBatch(Model):
    events: list[ObservationInput] = Field(min_length=1, max_length=25)


class ObservationView(ObservationInput):
    received_at: datetime


class IntegritySummary(Model):
    configuration: dict
    device_check: dict | None
    events: list[ObservationView]
    gaps: int
    observed_ms: int = 0
    client_reported: Literal[True] = True
    vision: VisionSummary | None = None


class TranscriptionView(Model):
    id: UUID
    question_id: UUID
    status: str
    original_text: str | None
    error: str | None
    duration_seconds: float
    model: str


class ProfileInput(Model):
    name: str = Field(min_length=2, max_length=60)
    role: str = Field(max_length=120)
    bio: str = Field(max_length=1000)
    notifications: bool = True
    reminders: bool = True
    default_type: Literal['Technical', 'HR', 'Behavioral', 'Mixed'] = 'Technical'
    default_mode: Literal['Text', 'Spoken'] = 'Spoken'


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
    modality: str | None = None
    original_transcript: str | None = None
    user_corrected: bool = False


class InterviewView(Model):
    id: UUID
    config: InterviewCreate
    status: str
    created_at: datetime
    deadline: datetime | None
    questions: list[QuestionView]
    report: Report | None
    device_check: dict | None = None
    observation_config: dict = Field(default_factory=dict)
    integrity: IntegritySummary | None = None
    transcriptions: list[TranscriptionView] = Field(default_factory=list)


class Allowance(Model):
    limit: int
    used: int
    reserved: int
    remaining: int


class Capabilities(Model):
    resumes_remaining: int
    interviews_remaining: int
    resume: Allowance
    interview: Allowance
    server_time: datetime
    window_started_at: datetime | None
    reset_at: datetime | None
    window_hours: int


class Workspace(Model):
    profile: ProfileInput
    capabilities: Capabilities
    resumes: list[ResumeView]
    interviews: list[InterviewView]


class FileLink(Model):
    url: str


class ErrorDetail(Model):
    quota: Capabilities | None = None
    code: str
    message: str
    request_id: str


class ErrorResponse(Model):
    error: ErrorDetail
