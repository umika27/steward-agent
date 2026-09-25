"""Local voice mock and future adapter boundary. No Gnani client or webhook."""
from abc import abstractmethod
from copy import deepcopy

from rails.base import BaseRail
from steward.commitments import create_commitment
from steward.models import Commitment, RailResult


class VoiceRail(BaseRail):
    @property
    def rail_name(self) -> str:
        return "voice"

    @abstractmethod
    def start_service_conversation(self, case_context: dict) -> RailResult:
        raise NotImplementedError

    @abstractmethod
    def receive_call_result(self, raw_call_payload: dict) -> RailResult:
        raise NotImplementedError

    @abstractmethod
    def extract_commitments(self, case_id: str, call_payload: dict) -> list[Commitment]:
        raise NotImplementedError


class MockVoiceRail(VoiceRail):
    """All results are local simulation, including sample booking references."""
    def __init__(self, reachable: bool = True):
        self.reachable = reachable

    @property
    def is_mock(self) -> bool:
        return True

    def start_service_conversation(self, case_context: dict) -> RailResult:
        return RailResult(self.rail_name, "start_service_conversation", self.reachable,
            summary="[MOCK] Local provider conversation" if self.reachable else "[MOCK] Provider unreachable",
            payload={"case_id": case_context["case_id"]},
            error_code=None if self.reachable else "PROVIDER_UNREACHABLE")

    def receive_call_result(self, raw_call_payload: dict) -> RailResult:
        return RailResult(self.rail_name, "receive_call_result", True,
                          summary="[MOCK] Supplied local call data", payload=deepcopy(raw_call_payload))

    def extract_commitments(self, case_id: str, call_payload: dict) -> list[Commitment]:
        return [create_commitment(case_id=case_id, source="local_mock", **item)
                for item in call_payload.get("commitments", [])]
