# Gnani manual observations

Source: user-supplied account of one real, manually observed Agent Builder test.
This is not evidence of a live Gnani-to-Steward backend integration.

## T01 — Normal cooperative call — RUN

Machine: Samsung front-load washing machine, not draining. The same problem was
repaired approximately four months previously for ₹1,200.

Observed result: Saturday 12–2 PM appointment, ₹900 visiting charge, reference
SAM-BLR-99201.

Observed positive behavior:

- Rejected an incomplete “twelve to...” time window.
- Asked again after unclear speech.
- Repeated the appointment details.
- Requested a booking/reference number.
- Recognized that ₹900 was within the ₹1,500 authority limit.

Observed weakness: the agent initially asked whether the previous repair had
service coverage, but that question remained unresolved when the call ended.
No conclusion about prior repair coverage can be drawn from this test.

Design response: each material question must be answered or preserved with an
explicit follow-up action and deadline. The reconstructed backend offers
`CaseManager.preserve_question`; its material commitment blocks closure until
resolved with evidence. A service visit does not automatically fulfill it.

The local demo reuses the reported appointment/price/reference as sample data.
Its explicit calendar date is a deterministic demo assumption, not an observed
Gnani response. All demo rail actions are local mocks.

## T02 and subsequent tests — NOT RUN

No additional observations or results have been supplied. Leave results blank
until real tests occur.
