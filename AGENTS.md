# Repository working agreement

## TL;DR

- Read `CONTRIBUTING.md`; it is the canonical workflow policy.
- Generate load only against explicitly authorized targets and preserve safety limits.
- Keep workload identity, execution configuration, raw evidence and analysis distinct.
- Run the exact checks and report their results honestly.

This file is the concise, tool-facing entry point for contributors and coding agents.
[CONTRIBUTING.md](CONTRIBUTING.md) is the canonical workflow policy. Normative terms such as
MUST, SHOULD and MAY have the meanings defined there.

## Before changing anything

1. You MUST read [CONTRIBUTING.md](CONTRIBUTING.md), especially its ambiguity, issue-timing,
   verification and external-side-effect rules.
2. You MUST inspect the branch and working tree and preserve pre-existing work.
3. You MUST read the relevant
   [engineering standards](docs/development/engineering-standards.md), workload and manifest
   guides, image guide, contract lock, and accepted [ADRs](docs/decisions/README.md).
4. You MUST use repository-local checks and MUST NOT claim an unavailable or unexecuted check
   passed.

If definitions, configuration bytes, scenarios, tests and documented measurement meaning
disagree, you MUST NOT silently pick one. Correct an obvious local defect or propose a
superseding ADR. Ordinary ambiguity follows CONTRIBUTING.

## Repository responsibility

`perfeng-k6` owns k6 API scenarios, native load profiles, versioned workload definitions,
safe local execution tooling, raw k6 capture, raw-result manifest assembly and the immutable
runner image. It does not own scheduling, target provisioning, storage uploads, normalization,
baseline selection or performance decisions.

- Shared contract meaning belongs in `perfeng-contracts`; this repository pins and validates an
  immutable snapshot.
- Orchestration supplies an authorized target, resolved execution configuration, secret
  references, artifact receipts and execution provenance.
- Raw summaries and points remain evidence. Thresholds and schema validity are not platform
  regression decisions.
- Kubernetes execution and artifact storage remain in their owning components.

## Shape of work

- Each task and pull request MUST deliver one coherent, independently reviewable runner outcome.
- Workload or measurement-semantic changes, dependency updates and broad cleanup MUST stay
  separate unless inseparable for correctness.
- Scope, assumptions, safety limits, load model, measurement window, compatibility, affected
  consumers and verification evidence MUST be explicit.
- Prefer a working scenario-to-artifact path over speculative frameworks or unused adapters.

## Load-generation and implementation rules

- Only target systems the operator owns or is authorized to test. Loopback remains the safe
  default; committed configuration MUST NOT point at a public service.
- Preserve explicit duration, arrival/VU model, concurrency, thresholds and phase boundaries.
  Increasing load or removing a safety bound is a behavioral change requiring focused review.
- A definition and its configuration hash are immutable workload identity. Byte changes require
  a new version and reviewed dependent updates.
- Runtime overrides, secrets, randomized input and target state are not captured by the static
  profile hash. Do not claim otherwise.
- k6 scenarios run in the k6 JavaScript runtime, not Node.js. Node-only modules belong in tooling,
  not scenario code.
- Missing summaries or points are never successful evidence. Preserve exit status, incomplete
  evidence and threshold outcomes independently.
- Runtime code and manifest assembly remain offline after dependencies are installed.

Follow the engineering standards and relevant README sections.

## Quality and documentation

- Test observable scenario, workload, output and contract behavior at the lowest boundary that
  proves it. Defect fixes SHOULD begin with a failing regression test.
- Fixture tests MUST remain loopback-only and MUST scrub developer credentials, destinations and
  k6 overrides.
- Tests MUST be deterministic except for measured latency and other explicitly asserted
  nondeterminism.
- Comments SHOULD explain load-model, safety or measurement decisions and SHOULD NOT narrate
  syntax.
- Long documents MUST include the TL;DR required by CONTRIBUTING.
- Scenarios, profiles, definitions, hashes, image inventory and documentation change together.

## Completion

The canonical required checks and completion-report format are defined in
[CONTRIBUTING.md](CONTRIBUTING.md). Follow them after every work item.
