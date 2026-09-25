"""Rails expose primitives; Steward owns policy and orchestration."""
from abc import ABC, abstractmethod


class BaseRail(ABC):
    @property
    @abstractmethod
    def rail_name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        raise NotImplementedError
