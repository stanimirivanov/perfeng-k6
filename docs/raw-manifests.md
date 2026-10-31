# Workload definitions and raw manifests

## TL;DR

- A workload definition binds exact native k6 configuration bytes to an immutable version and
  checksum.
- Assemble raw-result/v2 only from a frozen capture, original summary/points and verified storage
  receipts.
- The assembler validates local bytes and contracts; it does not upload, retrieve or attest remote
  objects.
- Runtime overrides and the true measurement interval require separate explicit capture.
- Missing or incomplete evidence remains a failed/incomplete run, never an invented successful
  manifest.

This repository provides workload/v1 definitions and an offline raw-result/v2 assembler.
It does not upload files, query a registry, verify remote objects, or infer a
scientific verdict. A valid manifest does not mean the run passed or delivered
its planned workload.

## Workload identity

Each of the 12 native profile/scenario combinations has a definition under
definitions/. Version 1.0.0 pins the exact native JSON bytes with SHA-256, uses
the appropriate open/closed model, declares zero excluded warm-up/cooldown, and
counts the full scheduled duration as measurement. dataset.kind: none means no
separately versioned dataset, not that the target has no state.

Normal Node runner invocations verify the definition before execution. Native
Docker/k6 invocation bypasses Node verification: its caller must perform the
same check against bytes extracted from the actual pinned image. The image
includes definitions/ but not the Node assembler or its dependencies.

Changing configuration bytes, including formatting or line endings, requires a
new hash and workload version. Existing definitions are immutable identities.
Runtime BASE_URL, API_VERSION, THINK_TIME, auth references and random input
choices are not captured by a static profile hash. Bundled scenarios reject
native `K6_*` environment variables; deployment adapters must also constrain
command-line options, which can override the reviewed profile.
A production adapter must preserve a separate immutable resolved-configuration
snapshot, record secret references rather than values, and control randomness.
Do not present a modified or fixture override run as the published workload.

## Required inputs

Use a frozen capture directory containing:

- The workload definition and its native configuration at the definition's
  relative configuration.path, taken from the runner artifact actually executed.
- The original summary.json and points.jsonl emitted by k6 2.2.0, without
  reformatting or filtering them.

The request is a JSON object with exactly these fields:

| Field             | Required value                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| runId             | Actual platform run ID, in perf-YYYYMMDD-HHMMSS-xxxxxxxx form                                                     |
| testId            | checkout-api, search-api, or account-api matching the workload                                                    |
| workloadFile      | Relative path to the frozen workload definition                                                                   |
| producer          | name: k6, version: 2.2.0, and artifact containing kind: oci-image plus the actual OCI reference pinned by SHA-256 |
| measurementWindow | Observed start and end of measurement, not planned duration or process start/finish                               |
| receipts          | Exactly two objects, each containing file and artifact                                                            |

Each receipt.file is relative to the capture root. Each receipt.artifact is a
complete [artifact/v1 reference](../vendor/contracts/schemas/artifact/v1/artifact-reference.schema.json):
id, runId, kind, uri, sha256, sizeBytes, mediaType, and format. The storage adapter
assigns immutable UUIDs and returns the actual stored-byte checksum and size.
Both artifacts use kind: raw and the request's run ID.

| Payload           | mediaType            | format          |
| ----------------- | -------------------- | --------------- |
| Summary           | application/json     | k6-summary-json |
| Individual points | application/x-ndjson | k6-json-points  |

URIs must be stable S3 or HTTPS object locations without credentials, queries,
or fragments. Signed URLs and local paths are not artifact locations. Require
the storage adapter to verify a completed upload before supplying its receipt.
This assembler compares those receipts against local bytes; it cannot prove the
remote upload happened or that the supplied image actually produced the data.
Use this capture directory only after files stop changing.

This adapter accepts UTC measurement timestamps with at most millisecond
precision. It rejects higher precision instead of silently truncating it.
Raw point timestamps may retain k6's greater precision. Point inspection only
checks that some data overlaps the supplied interval, not that the interval is
the true measurement phase or that every point belongs to it. A normalizer must
apply the supplied half-open interval [start, end) before computing measurements.

## Assemble

After producing and verifying the inputs, run from the repository:

```sh
npm ci --ignore-scripts
npm run manifest -- /absolute/frozen-capture /absolute/request.json /absolute/new-raw-result.json
```

Use absolute Linux paths and quote paths containing spaces.
The output parent must exist. An existing output is never overwritten, including
on retry. The CLI returns nonzero for invalid input or an output collision.
It does not rewrite raw files or contact their URIs.

The output includes the SHA-256 of the exact workload-definition bytes, both
verified artifact references, supplied OCI execution provenance, and the manifest
creation time. It uses schemaVersion 2 and contractsVersion 0.13.0. Creation
cannot precede measurement end. Caller-supplied IDs and receipts are reused; the
assembler does not silently allocate replacement identities.

Failure with retained measurements can still have a manifest; there is no
execution-success field. Execution errors, k6 threshold exits, measurement
quality, and missing artifacts must remain distinct in the orchestration layer.
No summary or no points means this two-artifact adapter cannot emit a manifest.
Keep incomplete raw evidence for diagnosis instead of fabricating a result.

## Validation and limitations

Validation uses Ajv's Draft 2020-12 implementation and format checks, with all
schema references resolved locally. The locked snapshot includes the five
raw-result/v2 schemas in the reference dependency chain and the upstream Apache license.
Neither a sibling repository nor Python is required. npm ci installs tooling;
subsequent validation and assembly are offline.

The validator checks configuration hashes and budgets, schema shape, producer
version, window order, artifact hashes/sizes, path containment (including
symlinks), stable locations, unique identities/locations/formats, and basic
native payload structure. Hashing and JSONL inspection stream point data;
the smaller summary is parsed in memory.

Native payload checks are deliberately not a full k6 decoder, statistical
validator, baseline comparison, or run attestation. Supplied test/workload/image/
window correspondence is still a trusted adapter responsibility. Synthetic test
receipts use example.invalid and a fixture S3 bucket; they are not deployed
objects or production provenance.

Run npm run validate and npm test. Tests include valid output, changed bytes,
unsafe paths, malformed payloads, wrong identities, missing data, unsupported
image references, bad windows, and output collision handling.
