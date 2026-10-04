"""Strict voice-only public inputs, bounded for short competition demo clips."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

MAX_AUDIO_BYTES = 6 * 1024 * 1024
MAX_BASE64_LENGTH = 4 * ((MAX_AUDIO_BYTES + 2) // 3)

class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)

class TranscribeInput(Input):
    audio_base64: str = Field(min_length=1, max_length=MAX_BASE64_LENGTH)
    filename: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9][A-Za-z0-9_. -]*$')
    language_code: str = Field(default='en-IN', pattern=r'^(en|hi|ta|te|kn|ml|mr|pa|bn|gu)-IN$')

class SynthesizeInput(Input):
    text: str = Field(min_length=1, max_length=500)
    # Phase 1 fixes the tested Indian-English voice/model/audio format.
    language: Literal['en-IN'] = 'en-IN'
    voice: Literal['Kaveri'] = 'Kaveri'
    model: Literal['timbre-v2.5'] = 'timbre-v2.5'
