# perfeng-k6

## TL;DR

- Provides versioned k6 API scenarios, native load profiles and immutable workload definitions.
- Executes only against an explicitly supplied authorized target; loopback is the safe default.
- Retains original summaries and sample points and assembles contract-valid raw-result manifests.
- Does not schedule runs, upload artifacts, normalize metrics, select baselines or make performance
  decisions.
- Uses k6 2.2.0 and Node.js 24.18.0. Start from the
  [documentation map](docs/README.md), run `make bootstrap`, and use `make verify`.

Standalone k6 API scenarios extracted from performance-platform. This repository
owns load generation, not scheduling, baselines, normalization, or performance
decisions. Requires k6 **2.2.0** and Node.js **24.18.0** for local tooling.
Node tooling uses locked Ajv dependencies for offline contract validation.
There is no Python project in this repository.

## Development and validation

Contributor workflow and repository policy are defined in
[CONTRIBUTING.md](CONTRIBUTING.md). Runner-specific design and verification rules are in the
[engineering standards](docs/development/engineering-standards.md), and durable decisions are
recorded in [ADRs](docs/decisions/README.md). The
[coding harness](docs/development/harness.md) defines command cost and ownership.

Install the exact locked dependencies, then run the portable harness:

```sh
make bootstrap
make verify
make validate
```

`make verify` runs formatting, repository policy, architecture, workload, and test feedback.
`make validate` adds supply-chain checks. `make image` separately builds and verifies the local
runner image when image-affecting files change.

Validation inspects all 12 profile/scenario combinations using the pinned k6
binary. Tests run checkout, search, and account flows against an ephemeral
loopback HTTP fixture, including failure cases. The fixture has deterministic
responses, not deterministic latency. Test artifacts remain in a newly created
OS temporary directory for inspection.

## Run

Only target systems you own or are authorized to load test. The default target
is loopback, not a public service. Set BASE_URL explicitly for your environment.

PowerShell:

```powershell
$env:BASE_URL = 'http://127.0.0.1:8080'
npm run run -- checkout smoke ./checkout-smoke-output
```

Shell:

```sh
BASE_URL=http://127.0.0.1:8080 npm run run -- checkout smoke ./checkout-smoke-output
```

The output directory must not exist; its parent must exist. Keep output outside
Git (the root results directory is ignored). Choose a fresh directory per run.
AUTH_TOKEN is optional and supplied through the environment; never commit tokens.
API_VERSION defaults to v1. THINK_TIME is seconds, defaults to 1, and can be 0
for fixture tests. Record such overrides with your run configuration.

The wrapper verifies the k6 version, checks the scenario/profile registry,
retains the k6 exit status (including threshold failure 99), and writes
summary.json plus points.jsonl. The bundled scenarios reject any `K6_*`
environment variable at initialization because native k6 options such as
`K6_VUS` can replace the reviewed profile. This applies to both the Node wrapper
and direct execution of the runner image. Keep execution flags fixed as well:
k6 command-line options have higher precedence than `--config`.

The runner verifies the selected workload definition and configuration checksum
before starting. Raw output is unmodified k6 output, not normalized metrics.
The separate [manifest builder](docs/raw-manifests.md) assembles a RawResult
from storage receipts and explicitly supplied capture provenance.
Summary statistics do not substitute for retained sample points.
Raw records may contain target URLs or other sensitive metadata; apply access
controls and retention policies. Initialization failures may produce no summary;
a missing artifact is never evidence of a successful run.

## Container

```sh
docker build -t perfeng-k6:0.1.0 .
docker run --rm --entrypoint k6 perfeng-k6:0.1.0 version
```

The default container command selects checkout/smoke and writes to /results.
Mount an empty writable directory there, and pass BASE_URL reachable from inside
the container. Container loopback is not the host. On Linux ensure the mount is
writable by the image's non-root user. Other scenarios can use the native CLI:

```sh
docker run --rm --mount type=bind,source=/absolute/fresh-output,target=/results \
  -e BASE_URL=http://authorized-fixture:8080 perfeng-k6:0.1.0 \
  run --no-usage-report --config workloads/smoke/search.json \
  --summary-export /results/summary.json --out json=/results/points.jsonl \
  tests/search/scenario.js
```

The image contains scenarios and profiles, not the Node tooling. Native Docker/k6
invocation does not provide the wrapper's existing-directory protection: always
supply a fresh output directory. The base image is digest-pinned. The final
runner image has its own distinct registry digest; consumers must pin that
digest. The manual [image publication workflow](docs/images.md) builds,
verifies, and optionally publishes it to GHCR without publishing on ordinary
pushes or pull requests.

## Boundaries and follow-up

Profiles remain native k6 configuration. Their versioned workload/v1 definitions
are under definitions/ and carry exact configuration hashes, model, and phase
budgets. All current ramps are part of measurement, with no excluded warm-up or
cooldown. The legacy
catalogue is retained under legacy/ as migration input, not advertised as a valid
current catalogue. Its names and metrics require explicit mapping.

The manifest builder emits raw-result/v2 and validates against five vendored
schemas from the pinned perfeng-contracts 0.13.0 snapshot recorded in
contracts.lock.json. Its producer provenance identifies the digest-pinned OCI
runner through `producer.artifact`. It checks every schema checksum before use
and never downloads schemas at runtime. Update the snapshot only through a
reviewed dependency change; do not edit vendored schemas.

Uploads, image/run attestation, resolved execution-configuration capture, and
automatic measurement-phase instrumentation remain adapter/integration work.
The builder does not invent these inputs or claim that supplied receipts prove
remote storage. Kubernetes execution and normalization remain separate work.

See [source provenance](docs/migration-provenance.md) for the extraction scope.
