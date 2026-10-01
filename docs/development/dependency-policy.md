# k6 runner dependency policy

## TL;DR

- `package-lock.json` is the exact Node dependency graph; install it with
  `npm ci --ignore-scripts`.
- Node dependencies support offline tooling and manifest assembly but are not
  copied into the k6 runner image.
- Admit dependencies only for current behavior after reviewing maintenance,
  license, security, compatibility, and replacement cost.
- Run `make supply-chain` for dependency changes and report unavailable
  network-backed scans honestly.
- GitHub Actions use semantic major tags; container inputs retain immutable
  digest pins.
- The CI k6 release archive is verified against the reviewed, checked-in
  Linux AMD64 checksum before extraction.

## Graph and runtime separation

`dependencies` contains Node tooling needed for contract validation and manifest
assembly. `devDependencies` contains repository quality tools. Neither graph is
available inside the k6 JavaScript runtime or copied into the runner image.
Runtime sources under `lib/` and `tests/` may use k6 modules and relative runtime
modules only; `make architecture-check` enforces that separation with the pinned
Acorn parser so comments and strings cannot create false import results.

`package-lock.json` pins exact artifacts and integrity hashes. Do not hand-edit
resolved versions or use `@latest`. Install without lifecycle scripts unless a
future dependency has a reviewed, documented need for one.

## Admission and updates

Before adding or upgrading a dependency, review the current behavior requiring
it, standard-library or existing alternatives, maintenance and vulnerability
history, transitive size, license, Node compatibility, and replacement cost.
Dependency-only changes SHOULD remain separate from workload or measurement
semantic changes unless inseparable for correctness or security.

`make vuln` checks the complete locked graph with npm audit. It may require
network access and its result is point-in-time evidence. `make license` checks
the lockfile inventory against the documented permissive allowlist. Do not
weaken either check merely to accept a new dependency.

## Automation and immutable pins

Dependabot may propose grouped npm and GitHub Actions updates. Those changes
still require normal workload, fixture, and image review. This repository does
not use GitHub's dependency-review action.

GitHub Action `uses:` references use semantic major tags. OCI base images and
published runner references are different trust boundaries and retain immutable
SHA-256 digests. Workload configuration hashes and contract lock hashes are
product identity and MUST NOT be rewritten by general dependency tooling.
The version in `.k6-version` and checksum in `.k6-linux-amd64.sha256` form one
reviewed CI tool selection and MUST change together.
