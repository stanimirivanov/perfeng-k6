# Contributing to perfeng-k6

## TL;DR

- Deliver one coherent, verified load-generation outcome per issue and pull request.
- Use MUST, SHOULD and MAY as defined below; lowercase wording is explanatory.
- Proceed on documented, reversible assumptions and stop for choices that materially affect
  workload identity, load safety, measurement meaning, compatibility, security or external state.
- Prepare requested changes without staging or committing, then print issue content for the
  repository owner.
- Run exact checks, including image verification where applicable, and report unavailable checks
  as not run—never as passed.
- Use exact published milestone titles in the form `MNN — Outcome`.

## Policy language and sources of truth

- **MUST** and **MUST NOT** identify requirements. A deviation needs an explicit reviewer-approved
  exception recorded in the issue or pull request.
- **SHOULD** and **SHOULD NOT** identify strong defaults. A deviation is allowed only when its
  reason and trade-off are recorded.
- **MAY** identifies an optional choice.

Lowercase guidance does not silently create another normative level.

| Concern                                                       | Canonical source                                                                                                          |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------ |
| Contributor workflow, issue timing, escalation and completion | This document                                                                                                             |
| Concise contributor and agent entry point                     | [AGENTS.md](AGENTS.md)                                                                                                    |
| k6 and JavaScript engineering                                 | [docs/development/engineering-standards.md](docs/development/engineering-standards.md)                                    |
| Architecture decisions                                        | [docs/decisions](docs/decisions/README.md)                                                                                |
| Cross-repository milestones                                   | [perfeng-environment roadmap](https://github.com/stanimirivanov/perfeng-environment/blob/main/docs/roadmap/milestones.md) |
| Supported behavior and exact commands                         | [README.md](README.md)                                                                                                    |
| Workload and manifest semantics                               | [docs/raw-manifests.md](docs/raw-manifests.md)                                                                            |
| Image publication                                             | [docs/images.md](docs/images.md)                                                                                          |

When sources conflict, the narrower source governs its concern. An accepted ADR governs its
decision until superseded. Surface unresolved conflict rather than quietly choosing the convenient
rule.

## Before starting

A contributor MUST inspect the branch and working tree and preserve unrelated changes; read
affected scenarios, profiles, definitions, tests, contract locks and documentation; identify the
smallest independently reviewable outcome; identify affected load, duration, measurement windows,
identities, contracts, consumers, packaging and operations; and select the workflow under
[Issue timing](#issue-timing).

A contributor MUST NOT discard, overwrite, reformat or incorporate unrelated work to obtain a
clean diff. Destructive operations and external writes outside the task require explicit
authorization.

An ADR MUST be proposed when a change establishes or revises durable workload semantics,
compatibility, contract consumption, security, repository ownership, foundational technology,
packaging topology or cross-component behavior.

## Ambiguity and escalation

Before escalating, inspect relevant code, profiles, definitions, fixtures, contracts, tests,
documentation, ADRs and issue history and perform safe read-only investigation.

A contributor MAY proceed with a documented assumption only when it is local, reversible and
inexpensive; stays in scope; does not alter workload identity, load magnitude, phase boundaries,
measurement conclusions, security or external state; does not weaken acceptance; and would not
materially change what reviewers believe they approve. Record the assumption and consequence.

A contributor MUST stop for a decision when missing information could materially change outcome,
milestone, target authorization, load model or magnitude, workload identity, measurement meaning,
compatibility, security, an irreversible action, publication or a choice between materially
different runner designs. State evidence, options, consequences and work that can safely continue.

## Issue timing

- When an issue number is supplied, follow its scope and milestone. A material mismatch follows
  the escalation rules.
- Without an issue number, prepare the smallest coherent requested change and print a complete
  proposed issue in the completion report. The owner creates the issue and then creates or renames
  the branch with its number.
- Contributors acting for the owner MUST NOT stage, commit, push, create or modify issues, create
  pull requests, run load against non-loopback targets, publish images, create releases, or change
  milestones unless explicitly requested.
- Read-only investigation and loopback-only verification MAY occur before an issue exists.

Creating or modifying GitHub records, packages, images or releases and sending load to an external
target are externally visible writes and require explicit authority.

## Milestones and required issue

Use exact published titles in the form `MNN — Short outcome`. Published milestones MUST NOT be
reused, renumbered or casually renamed. GitHub owns live assignment; the centralized
[roadmap](https://github.com/stanimirivanov/perfeng-environment/blob/main/docs/roadmap/milestones.md)
owns intended outcomes and sequencing.

Every implementation issue uses:

```markdown
**Repository:** perfeng-k6
**Milestone:** MNN — Outcome

## Goal

Describe the problem and observable result.

## Scope

- Included behavior and boundaries.

## Design decisions

- Choices, assumptions, workload and compatibility effects, and ADRs.

## Security and operations

- Target authorization, load safety, secrets, publication, rollout and recovery.

## Acceptance criteria

- [ ] Observable runner behavior and verification evidence.
- [ ] Relevant invalid, incomplete, threshold and failure behavior.
- [ ] Documentation, packaging and consumer effects.

## Verification

- Required, focused fixture, contract and image checks.

## Out of scope

- Explicit exclusions and deferred work.
```

Acceptance criteria MUST describe observable behavior or verifiable invariants, not implementation
activities. Known limitations MUST be visible.

## Pull-request-sized work

A pull request MUST solve one coherent runner problem, leave scenarios executable, include profiles,
definitions, hashes, tests, documentation and packaging changes required for the outcome, and prove
important invalid or incomplete behavior.

Split independent workload semantics, broad cleanup, dependencies and unrelated formatting. A
vertical change may touch scenario code, native configuration, workload definition, manifest logic
and image inventory when they form one observable result. Do not create placeholder scenarios or
execution adapters for roadmap appearance.

## Development workflow

1. Select the workflow defined in [Issue timing](#issue-timing).
2. Prepare one focused change without staging, committing or pushing for the owner.
3. Add or update loopback fixtures and tests.
4. Implement the smallest coherent solution and update definitions, hashes and documentation.
5. Format and run exact checks.
6. Review the diff for secrets, generated churn, load/measurement changes, assumptions, lock/package
   drift and unrelated edits.
7. Print the canonical [completion report](#completion-report).
8. The owner creates or confirms the issue and branch, may adjust the change, commits with `[#N]`,
   pushes and opens the pull request.

Do not store task-specific issue bodies, PR descriptions or handoff notes in the repository.

## External operations and destructive actions

Read-only inspection is allowed when relevant. Filesystem, Docker, registry, GitHub, target and
other mutations MUST remain within requested scope and authority.

- Run automated scenario tests only against the repository's ephemeral loopback fixture unless an
  authorized target and load envelope are explicitly supplied.
- Credentials, authorization headers and sensitive raw evidence MUST NOT appear in arguments, logs,
  fixtures, manifests, image layers or Git.
- Use fresh output locations. Existing evidence MUST NOT be overwritten as implicit recovery.
- Publishing images or releases requires explicit authorization and an immutable reviewed revision.
- Deletion, history changes, package replacement and external load require explicit authority and
  verified exact targets.

## Verification and constrained environments

Run every applicable required check:

```sh
npm ci --ignore-scripts
npm run format:check
npm run validate
npm test
```

`make validate` wraps the portable checks after dependencies are installed. Scenario, profile,
definition, Dockerfile or image-inventory changes MUST also build and verify the runner image as
documented. Tests MUST use the pinned k6 version.

When a check cannot run because of sandbox, platform, network, credentials, Docker, k6 or another
environmental constraint, report the exact command as **not run**, the blocker and attempts, checks
that passed, residual risk, and where it should run. Never weaken a check or claim an unexecuted
check passed. Report a failure even when it appears unrelated.

## Documentation

Every long narrative document MUST contain `## TL;DR` immediately after its title and status
metadata. A document is long when it has at least 800 words, more than five second-level sections,
or is an architecture, security, compatibility, migration or operational guide readers consult
selectively. Issue and PR templates are excluded.

The TL;DR SHOULD state purpose, intended reader, important outcome and next action in three to seven
bullets. Load model, supported scenarios, workload identity, measurement-window meaning, contract
provenance, CLI and image behavior change with the code that makes them inaccurate. Accepted ADRs
are historical; supersede rather than rewrite.

## Pull request description

A pull request MUST state the linked issue and milestone; outcome and exclusions; assumptions and
unresolved questions; workload, contract and compatibility effects; verification including checks
not run; target safety, packaging, security, publication, rollout and rollback; and known
limitations.

## Review checklist

- [ ] MUST: The issue uses the required structure and exact milestone title.
- [ ] MUST: The change is one coherent load-generation outcome.
- [ ] MUST: Target authorization, load magnitude, model, duration and phase boundaries are explicit.
- [ ] MUST: Definitions, profile bytes, hashes, scenarios and documentation agree.
- [ ] MUST: Exit status, thresholds, incomplete evidence and measurement outcomes remain distinct.
- [ ] MUST: Success and relevant invalid/incomplete paths are tested against loopback fixtures.
- [ ] MUST: Contract locks, manifest claims, image inventory and documentation agree.
- [ ] MUST: Applicable portable and image checks passed or are reported.
- [ ] MUST: No secrets, result data, external targets, machine paths or unrelated churn are present.
- [ ] MUST: An ADR exists when the decision meets the ADR threshold.

## Completion report

After every work item, print the repository, exact milestone, proposed issue title, complete issue
body, assumptions and limitations, verification outcomes distinguished as passed/failed/not run,
and a suggested `[#N]` commit subject. When an issue exists, repeat or amend it so delivered scope
is auditable. Printing the report does not publish external records.
