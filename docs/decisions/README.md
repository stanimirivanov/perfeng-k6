# Architecture decision records

## TL;DR

- Use an ADR for durable decisions affecting workload meaning, safety, compatibility, security,
  ownership or cross-component behavior.
- Number ADRs sequentially and never reuse a number.
- Allocate from fresh repository state and renumber concurrent collisions.
- Accepted ADRs are historical records; supersede rather than rewrite them.
- Record alternatives, consequences, load-safety implications and validation.

## When an ADR is required

Create an ADR when a decision materially affects the execution/load model, measurement semantics,
target safety, public compatibility, contract consumption, security or privacy, repository
ownership, foundational technology, packaging topology or cross-component behavior. Cheap local
implementation choices do not need one.

## Naming and lifecycle

Use a four-digit sequence and short kebab-case name:

```text
0001-select-arrival-rate-model.md
```

Statuses are Proposed, Accepted, Rejected, Deprecated or Superseded. Add every ADR to the index and
do not rewrite accepted decisions or consequences.

Immediately before creating an ADR, refresh the branch as the workflow allows and inspect this
index and directory. Allocate the lowest unused number. If concurrent work collides, rename the
later ADR to the next available number and update its title, index and references. Published numbers
remain immutable.

## Template

```markdown
# ADR-NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD
- Milestone: MNN — Outcome
- Deciders:
- Supersedes:
- Superseded by:

## Context

What forces a decision now? Include load, safety and compatibility constraints.

## Decision

State the decision and scope precisely.

## Alternatives considered

### Alternative

- Benefits:
- Costs and risks:
- Reason not selected:

## Consequences

### Positive

### Negative

### Neutral or follow-up

## Compatibility and migration

## Security and operations

## Load-safety and measurement limitations

## Validation

How will assumptions and consequences be verified?
```

## Index

No ADRs have been accepted yet.
