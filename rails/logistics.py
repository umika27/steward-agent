"""Local logistics simulation. No Delhivery shipments are created or queried."""
from abc import abstractmethod

from rails.base import BaseRail
from steward.models import RailResult


class LogisticsRail(BaseRail):
    @property
    def rail_name(self) -> str:
        return "logistics"

    @abstractmethod
    def validate_address(self, address: str, pincode: str) -> RailResult:
        raise NotImplementedError

    @abstractmethod
    def track_part(self, tracking_reference: str, part_name: str) -> RailResult:
        raise NotImplementedError

    @abstractmethod
    def get_delivery_status(self, tracking_reference: str) -> RailResult:
        raise NotImplementedError


class MockLogisticsRail(LogisticsRail):
    def __init__(self):
        self._shipments: dict[str, dict[str, str]] = {}

    @property
    def is_mock(self) -> bool:
        return True

    def validate_address(self, address: str, pincode: str) -> RailResult:
        valid = bool(address.strip()) and len(pincode) == 6 and pincode.isdigit()
        return RailResult(self.rail_name, "validate_address", valid,
            summary="[MOCK] Format check only; no real serviceability lookup",
            error_code=None if valid else "INVALID_ADDRESS")

    def track_part(self, tracking_reference: str, part_name: str) -> RailResult:
        if not tracking_reference.strip() or not part_name.strip():
            raise ValueError("Part tracking needs a reference and part name")
        self._shipments.setdefault(tracking_reference, {"part_name": part_name, "status": "IN_TRANSIT"})
        return self.get_delivery_status(tracking_reference)

    def mark_part_delivered(self, tracking_reference: str) -> None:
        self._shipments[tracking_reference]["status"] = "DELIVERED"

    def get_delivery_status(self, tracking_reference: str) -> RailResult:
        payload = self._shipments.get(tracking_reference)
        return RailResult(self.rail_name, "get_delivery_status", payload is not None,
            summary="[MOCK] Local part status", payload=dict(payload or {}),
            error_code=None if payload else "NOT_FOUND")
