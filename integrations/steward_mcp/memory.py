"""Persist supplied records without interpreting them or changing case state."""
import json

from .config import REPO_ROOT
from .schemas import (
    Evidence, MachineFacts, MemoryResult, Provenance, ToolFailure, UpdateMemoryInput,
    UpdateMemoryResult, now_iso,
)
from .storage import Storage, encode

CANONICAL_FIXTURE = REPO_ROOT / "data/machines/WM-001.json"


class MachineMemory:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.seed()

    def seed(self):
        with self.storage.transaction() as connection:
            if connection.execute("SELECT 1 FROM machines WHERE machine_id='WM-001'").fetchone():
                return
            original = json.loads(CANONICAL_FIXTURE.read_text(encoding="utf-8"))
            seeded_at = now_iso()
            evidence = Evidence(source="CANONICAL_FIXTURE", reference="data/machines/WM-001.json",
                                observed_at=seeded_at, is_simulated=True).model_dump()
            facts = {
                "machine_id": original["machine_id"], "category": original["category"],
                "brand": original["brand"], "model": original.get("model"),
                "purchase_year": original["purchase_year"], "purchase_date": original.get("purchase_date"),
                "warranty": original["warranty"],
                "household_preferences": {
                    "availability": original.get("preferred_availability"),
                    "repair_limit_inr": original.get("autonomous_repair_limit_inr"),
                    "replacement_estimate_inr": original.get("estimated_replacement_cost_inr"),
                },
                "prior_failures": [dict(record_id=item["failure_id"], case_id=item["case_id"],
                    date=item["date"], problem=item["problem"], fault_type=item["fault_type"],
                    notes=item.get("notes"), evidence=evidence) for item in original["failure_history"]],
                "prior_repairs": [dict(record_id=item["repair_id"], case_id=item["case_id"],
                    date=item["date"], problem=item["problem"], work_description=item["resolution_summary"],
                    amount_inr=item["cost_inr"], provider_name=item["provider_name"],
                    provider_id=None, parts_replaced=item["parts_replaced"],
                    household_confirmation_reference=("canonical_fixture:" + item["repair_id"] + ":household_confirmation"
                        if item.get("verified_by_household") is True else None), evidence=evidence)
                    for item in original["repair_history"]],
                "cumulative_repair_spend_inr": original["cumulative_repair_spend"],
                "provider_history": [dict(provider_id=item["provider_id"], name=item["name"],
                    phone=item.get("phone"), last_used_date=item.get("last_used_date"),
                    notes=item.get("notes"), evidence=evidence) for item in original["previous_providers"]],
                "service_events": [], "household_observations": [],
            }
            checked = MachineFacts.model_validate(facts).model_dump(mode="json")
            connection.execute("INSERT INTO machines VALUES (?, 1, ?, ?)",
                               (checked["machine_id"], encode(checked), seeded_at))

    def get(self, machine_id: str) -> MemoryResult:
        with self.storage.read() as connection:
            row, document = self.storage.machine(connection, machine_id)
            return MemoryResult(machine=MachineFacts.model_validate(document), revision=row["revision"],
                provenance=Provenance(source="mcp_runtime", reference="machine:" + machine_id,
                                      observed_at=row["observed_at"], is_simulated=True), retrieved_at=now_iso())

    def update(self, request: UpdateMemoryInput) -> UpdateMemoryResult:
        arguments = request.model_dump(mode="json")
        with self.storage.transaction() as connection:
            replay = self.storage.replay(connection, "update_machine_memory", arguments)
            if replay is not None:
                return UpdateMemoryResult.model_validate(replay)
            row, document = self.storage.machine(connection, request.machine_id)
            if row["revision"] != request.expected_revision:
                raise ToolFailure("VERSION_CONFLICT", "Machine revision changed; retrieve memory before a new update")
            collections = {
                "append_failure": "prior_failures", "append_service_event": "service_events",
                "append_household_observation": "household_observations", "append_repair_record": "prior_repairs",
            }
            record_ids = {record["record_id"] for key in collections.values() for record in document[key]}
            applied = []
            for update in request.updates:
                record = update.model_dump(mode="json", exclude={"type"})
                record["case_id"] = request.case_id
                if record["record_id"] in record_ids:
                    raise ToolFailure("INVALID_ARGUMENT", "Record ID already exists; replay with the original idempotency key")
                if update.type == "append_repair_record":
                    reference = record.get("household_confirmation_reference")
                    if reference:
                        # Check a supplied reference, without deciding the physical outcome.
                        observations = document["household_observations"]
                        if not any(item["record_id"] == reference and item["case_id"] == request.case_id
                                   for item in observations):
                            raise ToolFailure("INVALID_ARGUMENT", "Household reference must name an observation for this case")
                    document["cumulative_repair_spend_inr"] += record["amount_inr"]
                document[collections[update.type]].append(record)
                record_ids.add(record["record_id"])
                applied.append(record["record_id"])
            checked = MachineFacts.model_validate(document).model_dump(mode="json")
            observed_at = now_iso()
            result = UpdateMemoryResult(machine_id=request.machine_id, case_id=request.case_id,
                revision=row["revision"] + 1, applied_record_ids=applied,
                provenance=Provenance(source="pine_supplied", reference="memory-write:" + request.idempotency_key,
                                      observed_at=observed_at, is_simulated=True))
            connection.execute("UPDATE machines SET revision=?, document=?, observed_at=? WHERE machine_id=?",
                               (result.revision, encode(checked), observed_at, request.machine_id))
            self.storage.receipt(connection, "update_machine_memory", arguments, result.model_dump(mode="json"))
            return result
