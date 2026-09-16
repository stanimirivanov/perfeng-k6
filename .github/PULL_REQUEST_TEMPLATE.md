## Linked work

- Issue:
- Milestone: MNN — Outcome

## Outcome and scope

Problem and resulting behavior:

Boundaries and deliberate exclusions:

Assumptions and unresolved questions:

## Design, compatibility and operations

- ADRs:
- Load model, magnitude, duration and phase effects:
- Workload, metric and measurement-semantic effects:
- Contract, CLI and image compatibility effects:
- Target authorization and safety effects:
- Security effects:
- Rollout, recovery and rollback:
- Externally visible or destructive actions authorized by:

## Verification

- [ ] Prettier format check
- [ ] Workload/scenario validation with the pinned k6 version
- [ ] Node integration and contract tests
- [ ] Runner image build and verification where applicable

Commands and non-secret evidence:

Checks not run, blocking reason and residual risk:

## Limitations and review

- [ ] One coherent, independently mergeable outcome
- [ ] Target, load bounds and stop behavior are explicit
- [ ] Scenarios, profiles, definitions, hashes and documentation agree
- [ ] Relevant invalid, incomplete and threshold behavior is tested
- [ ] No lint-suppression comments added merely to silence findings
- [ ] No secrets, result data, external targets, machine-specific paths or unrelated churn
- [ ] No unapproved external load, publication or destructive side effects

Known limitations and follow-up:
