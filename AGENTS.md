# Repository agent guide

## Agent skills

Use `mattpocock/skills` as the primary workflow for planning, ticketing,
implementation, TDD, review, and pull requests. The skills take precedence where
contributor guidance covers the same steps. Follow the repository's technical
requirements, CI gates, and authorization boundaries.

### Issue tracker

Use GitHub Issues in `stanimirivanov/perfeng-k6`. See [issue tracker configuration](docs/agents/issue-tracker.md).

### Triage labels

Use the default Matt Pocock label mapping. See [triage labels](docs/agents/triage-labels.md).

### Domain docs

Single context with a root glossary and ADRs in `docs/decisions/`. See [domain docs](docs/agents/domain.md).

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

The [coding harness guide](docs/development/harness.md) defines command tiers and feedback
sensors. New runtime or tooling paths MUST join the executable boundary policy, and new recurring
guidance MUST be routed from the documentation map.

## Quality and documentation

- Test observable scenario, workload, output and contract behavior at the lowest boundary that
  proves it.
- Fixture tests MUST remain loopback-only and MUST scrub developer credentials, destinations and
  k6 overrides.
- Tests MUST be deterministic except for measured latency and other explicitly asserted
  nondeterminism.
- Comments SHOULD explain load-model, safety or measurement decisions and SHOULD NOT narrate
  syntax.
- Long documents MUST include the TL;DR required by CONTRIBUTING.
- Scenarios, profiles, definitions, hashes, image inventory and documentation change together.

## Verification

Run `make verify` and the applicable additional checks documented in
[CONTRIBUTING.md](CONTRIBUTING.md#verification-and-constrained-environments).
Use the [documentation map](docs/README.md) to find affected standards, operational
guides and decisions. Report checks as passed, failed or unavailable.
