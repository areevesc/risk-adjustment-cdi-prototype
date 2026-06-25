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
- Scheduling outreach is derived from same-patient calendar-year appointments and current-year prospective actions. When no appointment exists, selected prospective actions can create a Scheduling Outreach downstream task.
