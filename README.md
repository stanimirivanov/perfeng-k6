# perfeng-k6

Standalone k6 API scenarios extracted from performance-platform. This repository
owns load generation, not scheduling, baselines, normalization, or performance
decisions. Requires k6 **2.2.0** and Node.js **24.18.0** for local tooling.
There are no npm dependencies and no Python project in this repository.

## Validate

```sh
npm run validate
npm test
```

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
summary.json plus points.jsonl. Native k6 environment options can still override
profile settings; use a controlled environment for reproducible runs. Do not
set options that disable thresholds or summaries in verification runs.

Raw output is unmodified k6 output, not normalized metrics or a RawResult
manifest. Summary statistics do not substitute for retained sample points.
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
supply a fresh output directory. The base tag pins the tool version but is not
a cryptographically immutable image identity. Production promotion must pin a
verified image digest.

## Boundaries and follow-up

Profiles remain native k6 configuration, not workload/v1 contracts. The legacy
catalogue is retained under legacy/ as migration input, not advertised as a valid
current catalogue. Its names and metrics require explicit mapping.

The next slice adds versioned workload descriptors and raw-result publication
using accepted perfeng-contracts schemas, a real image digest, checksums, and
real stored-artifact URIs. No placeholder URI or digest is emitted here.
Kubernetes execution and uploads belong to later integration work.

See [source provenance](docs/migration-provenance.md) for the extraction scope.
