from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
import re


class TrackRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: Literal["catalog", "native"]
    id: str = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def valid_id(self):
        pattern = r"[0-9]{1,20}" if self.source == "catalog" else r"[0-9A-Fa-f]{16}"
        if not re.fullmatch(pattern, self.id):
            raise ValueError(
                "Catalog IDs must be numeric; native persistent IDs must be 16 hex digits."
            )
        if self.source == "native":
            self.id = self.id.upper()
        return self


class AudioFeature(BaseModel):
    """Optional user-provided estimates; never pretend Apple supplies these."""

    model_config = ConfigDict(extra="forbid")
    id: str
    bpm: float | None = Field(default=None, gt=0, le=400)
    key: str | None = Field(default=None, pattern=r"^(?:[1-9]|1[0-2])[AB]$")
    energy: float | None = Field(default=None, ge=0, le=1)
