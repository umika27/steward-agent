"""Local payment simulation. No Pine Labs transactions are performed."""
from abc import abstractmethod
from copy import deepcopy

from rails.base import BaseRail
from steward.authority import AuthorityEngine
from steward.models import AuthorityEvaluation, RailResult, validate_amount


class PaymentRail(BaseRail):
    @property
    def rail_name(self) -> str:
        return "payments"

    @abstractmethod
    def request_payment(self, case_id: str, amount_inr: int, payee: str,
                        human_approved: bool = False, simulate_failure: bool = False) -> RailResult:
        raise NotImplementedError

    @abstractmethod
    def get_payment_status(self, transaction_id: str) -> RailResult:
        raise NotImplementedError


PaymentsRail = PaymentRail  # Name recovered from cached module.


class MockPaymentsRail(PaymentRail):
    def __init__(self, authority_engine: AuthorityEngine | None = None):
        self._authority = authority_engine or AuthorityEngine()
        self._transactions: dict[str, RailResult] = {}

    @property
    def is_mock(self) -> bool:
        return True

    def check_authority(self, amount_inr: int, authority_engine: AuthorityEngine | None = None) -> AuthorityEvaluation:
        return (authority_engine or self._authority).can_approve_repair(amount_inr)

    def request_payment(self, case_id: str, amount_inr: int, payee: str,
                        human_approved: bool = False, simulate_failure: bool = False) -> RailResult:
        validate_amount(amount_inr)
        authority = self.check_authority(amount_inr)
        if authority.denied or (not authority.allowed and human_approved is not True):
            return RailResult(self.rail_name, "request_payment", False,
                summary="[MOCK] Payment blocked by authority", error_code="AUTHORITY_REQUIRED")
        prior = self._transactions.get(case_id)
        if prior and prior.success:
            if prior.payload["amount_inr"] != amount_inr or prior.payload["payee"] != payee:
                raise ValueError("Conflicting payment for already settled case")
            return deepcopy(prior)
        result = RailResult(self.rail_name, "request_payment", not simulate_failure,
            summary="[MOCK] Payment failed" if simulate_failure else "[MOCK] Payment settled locally",
            payload={"transaction_id": f"MOCK-PAY-{case_id}", "status": "FAILED" if simulate_failure else "SETTLED",
                     "amount_inr": amount_inr, "payee": payee},
            error_code="PAYMENT_FAILED" if simulate_failure else None)
        self._transactions[case_id] = deepcopy(result)
        return result

    def get_payment_status(self, transaction_id: str) -> RailResult:
        result = next((r for r in self._transactions.values() if r.payload["transaction_id"] == transaction_id), None)
        return deepcopy(result) if result else RailResult(self.rail_name, "get_payment_status", False,
            summary="[MOCK] Unknown transaction", error_code="NOT_FOUND")
