# Rail status

| Rail | Internal boundary | Supplied implementation | Live integration |
| --- | --- | --- | --- |
| Voice | VoiceRail | MockVoiceRail; local structured call results | None; Gnani manual T01 is separate evidence |
| Payments | PaymentRail (PaymentsRail alias) | MockPaymentsRail; local authority/settlement simulation | None; no Pine Labs transactions |
| Logistics | LogisticsRail | MockLogisticsRail; local address format/part tracking | None; no Delhivery shipments |

`RailResult` exposes success, error code, summary, payload and `is_mock`. The
case manager records results on the case. These interfaces are internal contracts,
not assertions about any vendor's API or webhook schema.
