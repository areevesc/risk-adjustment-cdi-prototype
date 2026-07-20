# Risk Adjustment CDI Prototype

## Open The App

Double-click `start-app.cmd`.

The command window must stay open while you use the app. It starts Vite and opens:

`http://127.0.0.1:5173/`

If you prefer a terminal:

```powershell
npm.cmd run open
```

## Useful Commands

```powershell
npm.cmd run build
npm.cmd test
```

This is a local prototype only. It uses synthetic data, deterministic decision-support rules, and rule-based recommendation labels. It does not use PHI, external AI APIs, EHR, payer, CMS, or scheduling integrations.

## Implemented Prototype Rules

- Audit sampling uses a deterministic percentage setting and records whether an audit was manually started or selected by the prototype sample.
- Scheduling outreach is derived from same-patient calendar-year appointments and current-year prospective-review decisions. When no appointment exists, selected `Yes` or `Change` decisions can create a Scheduling Outreach downstream task.

## Prospective Handoff Decision Record

- A claim-year decision and a prospective handoff are independent. A reviewer can validate a condition for CY 2025 and also stage `Send to Prospective for CY 2026` on the same condition.
- The handoff targets the next calendar year and is not blocked merely because the source review is retrospective or prior-year. Normal chart-lock and role permissions still apply.
- The optional note is an internal CDI note for the shared `Prospective Review Queue`; it is not assigned to one specific prospective coder and it is not a provider query.
- Handoffs remain reversible drafts through Pend and create a persisted queue/ledger entry only when the review is completed.
- Open handoffs surface on a same-patient review for the target calendar year. If no such review or upcoming visit exists yet, the handoff remains in the shared queue ledger until that future workflow exists.

Product direction still to confirm with CDI leadership: whether provider-query authoring should later be modeled as a separate step after prospective review. If that direction changes, keep the independent internal handoff but add or revise the provider-facing query workflow separately.
