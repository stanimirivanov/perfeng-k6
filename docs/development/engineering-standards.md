# k6 engineering standards

## TL;DR

- Treat target authorization and bounded load as correctness requirements.
- Keep scenarios, native profiles, workload identity, resolved execution state and raw evidence
  explicit and separate.
- Preserve original summary and point data; missing evidence is never a successful run.
- Keep k6 runtime code independent from Node-only tooling.
- Pin contracts, dependencies, k6 and image inputs; verify the final runner artifact.
- Test scenarios against loopback fixtures and keep runtime behavior offline after installation.

## Policy strength

Normative terms use the meanings in
[CONTRIBUTING.md](../../CONTRIBUTING.md#policy-language-and-sources-of-truth). MUST and MUST NOT are
requirements; SHOULD and SHOULD NOT are strong defaults requiring a recorded reason to deviate; MAY
is optional.

## Architecture and ownership

Organize around scenario behavior, native profiles, versioned workload definitions, safe execution,
raw capture, contract-valid manifest assembly and runner packaging.

- Scenarios express user/API behavior and record raw k6 metrics. They do not choose baselines or
  declare platform regressions.
- Native profile JSON owns the k6 execution model, durations, rates/VUs and thresholds.
- Workload definitions bind reviewed profile bytes to stable identity and declared budgets.
- Node tooling validates definitions, executes the pinned k6 binary and assembles manifests. It does
  not run inside the k6 JavaScript runtime.
- The manifest builder binds caller-supplied verified receipts to local bytes. It does not upload,
  retrieve or attest remote objects.
- Shared contract definitions remain in `perfeng-contracts`; scheduling, storage, normalization and
  analysis remain in their owning repositories.

Use SOLID and patterns as reasoning tools, not quotas. Prefer explicit scenario modules, small
validation functions and direct data flow over generic runners, managers or speculative plugin
systems.

## Target and load safety

- Only generate load against a target the operator owns or is explicitly authorized to test.
- Committed defaults and automated tests MUST remain loopback-only. Never commit a public or shared
  service as the default target.
- Treat changes to VUs, arrival rate, iterations, duration, ramp, graceful stop, thresholds and
  retry behavior as load-bearing behavioral changes.
- Every load change documents expected peak concurrency/rate, total duration, stop behavior and
  affected environments.
- Bound retries and polling. A target failure MUST NOT create an uncontrolled retry storm.
- Preserve k6's exit status, including threshold failure, and ensure cancellation or orchestration
  termination stops further load.
- Never run a non-loopback acceptance test merely because configuration is available in the
  developer environment.

## Workload and measurement semantics

- Test ID, scenario/profile identity, workload version, execution model and configuration checksum
  are explicit.
- Published workload definitions are immutable identities. Any configuration-byte change,
  including formatting or line endings, requires a reviewed version and checksum update.
- Measurement, warm-up and cooldown boundaries are explicit. Do not infer an observed measurement
  window from planned duration or process start/finish.
- Raw thresholds are producer evidence; they do not replace platform quality, SLO or regression
  policy.
- Summary aggregates never substitute for retained sample points when downstream normalization
  requires them.
- Missing, truncated or malformed summary/point output remains incomplete evidence. Never fabricate
  a successful artifact or zero measurement.
- Preserve metric names, units, value types, tags and better/worse direction. A semantic rename or
  unit change requires coordinated consumer migration.
- Runtime environment overrides, target state, secret references, randomized data and fixture
  shortcuts are separate from a static profile hash and require a resolved execution record.

## JavaScript and k6 runtime design

- Use the Node version in `.node-version`, the k6 version in `.k6-version`, and exact dependencies
  in `package-lock.json`.
- Scenario modules run under k6, not Node.js. Do not import Node built-ins or rely on browser/Node
  globals in scenario code.
- Keep expensive or one-time initialization out of the default VU function when k6 lifecycle hooks
  can express it explicitly.
- Validate environment values before use. Reject non-finite, negative or unsafe numeric overrides
  rather than relying on JavaScript coercion.
- Keep authentication values in environment or secret delivery. Do not put them in URLs, logs,
  summaries, manifests or committed configuration.
- Make check names, tags and custom metric names stable and meaningful to downstream consumers.
- Use deterministic test data where feasible. When randomness is part of the workload, record its
  strategy and control it at the adapter boundary.
- Keep module import behavior side-effect-free except for k6 metric declaration and immutable
  configuration parsing required by the runtime.

## Raw evidence, contracts and filesystem safety

- Treat requests, JSON, JSONL, paths, receipts and artifact locations as untrusted input.
- Reject duplicate JSON keys where the parser permits it, non-finite values, path escape including
  symlinks, unsupported identities, checksum/size mismatch and unstable artifact locations.
- Bound input sizes, line lengths, collection counts, diagnostic output and validation work before
  expensive parsing.
- Hash and inspect large point streams incrementally; do not load unbounded JSONL into memory.
- Read capture bytes only after writers have completed. Do not modify, filter or reformat original
  evidence in place.
- Publish assembled output atomically and exclusively. Existing output is never overwritten on
  retry and failed attempts leave no partial final document.
- Resolve schemas from the verified vendored snapshot. Runtime code MUST NOT fetch contracts.
- Contract shape, storage receipt, image reference and source revision are claims with distinct
  trust boundaries; do not let one imply another.

## Packaging and compatibility

- Treat scenario behavior, metric names, profile bytes, workload definitions, CLI arguments,
  artifact formats, contract locks and image contents as compatibility boundaries.
- Never change published workload or metric meaning in place.
- Update vendored contracts only through a reviewed snapshot change that verifies exact bytes,
  license and affected consumers.
- The runner image contains only required scenarios, profiles, definitions and runtime assets. It
  excludes Node tooling, credentials, results and development state.
- Pin the base image and verify the final Linux AMD64 runner image, non-root identity, entry point,
  inventory hashes and source revision. Deployments consume the verified final registry digest.
- Image publication is manual, main-only and separate from ordinary validation.

## Formatting, tests and fixtures

- Prettier owns repository-authored JavaScript, JSON, Markdown and workflow formatting. Vendored
  contracts and hash-addressed definitions/profiles are excluded because formatting changes bytes.
- `npm run validate` verifies every supported scenario/profile combination using the pinned k6
  executable.
- Node tests cover runner behavior, contract assembly, filesystem boundaries and image policy.
- Scenario execution tests use only the ephemeral loopback fixture and scrub inherited k6 outputs,
  credentials and runtime overrides.
- Defect fixes SHOULD begin with a failing regression test.
- Test exact boundary values, invalid overrides, threshold failures, missing output, changed bytes,
  unsafe paths, wrong identities and output collisions.
- Tests MUST be deterministic, isolated and independent of network, locale, filesystem ordering and
  wall clock unless those are the subject. Latency values from the loopback fixture are not
  deterministic and MUST NOT be asserted as performance baselines.

## Documentation and dependencies

- Document target assumptions, authorization, execution model, load budgets, phase boundaries,
  runtime overrides, expected artifacts, limitations and caller responsibilities.
- Comments explain safety, load-model and measurement decisions, not syntax.
- Long documents follow the TL;DR policy in CONTRIBUTING.
- Runtime dependencies require a current need, compatible license, maintained release, exact lock,
  security review and a proportionate replacement boundary.
- Development tooling MUST NOT enter the runner image or runtime dependency graph.

## Required verification

Run the exact portable checks in CONTRIBUTING. Scenario, profile, definition, Dockerfile or image
inventory changes also require the local image build and verification. Non-loopback tests require
separate explicit authorization and are never implied by this repository's normal validation.
