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
- Condition evidence is owned structurally by the condition. Narrative text matching can detect weak demo content, but it cannot delete an otherwise valid condition-to-evidence link.
- Claim eligibility controls claim actions, while encounter and note eligibility determine whether clinical documentation supports validation.
- Completed, Under Audit, and Audit Complete reviews are read-only and do not appear in a CDI/coder's active queue.

## Visit-Based Workflow Decision Record

- Review context is derived as retrospective, scheduled upcoming visit, or no upcoming visit. The reporting label (`Concurrent`, `Prospective`, or `Retrospective`) does not independently choose the available actions.
- An eligible current-year claim with eligible signed assessment-and-plan support recommends `Validate`. Once committed, it displays as `Captured for <year>` and exposes no provider-query or prospective action.
- A supported uncaptured opportunity with an attached appointment exposes `Prepare Provider Query`. Completion creates a Provider Query task tied to that appointment.
- The same opportunity without an attached appointment exposes `Send to Prospective`. This is an unscheduled hold for the patient's next review and does not display a target calendar year.
- Prior-year reconciliation exposes only the applicable validate, delete, add, dismiss, and change-code decisions for that year. It does not create a generic next-year handoff.
- Decisions and routes are separate audit concepts. Drafts remain reversible through Pend and downstream tasks are persisted when the review is completed.

`Prepare Provider Query` currently creates the routed task and appointment reference. A full provider-facing query composer remains outside this prototype pass.
