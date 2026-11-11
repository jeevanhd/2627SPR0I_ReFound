## What this PR does

<!-- Describe the change. -->

Incident: <!-- link the incident issue, e.g. #6 -->

## What a direct push to the default branch hides

- No reviewer ever sees the diff before it lands on `main`.
- It hides who changed what and why, because there is no PR discussion or approval.
- The author can rewrite history without anyone noticing.
- "It is on main" gets confused with "it is live". `main` is not a deployment.

## Checklist

- [ ] Work is on a feature branch, not pushed directly to `main`
- [ ] A teammate has reviewed this PR before merge
- [ ] No secrets, no paid plan, nothing deployed
