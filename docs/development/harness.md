# k6 runner coding harness

## TL;DR

- Use the [documentation map](../README.md) for task-specific guidance and run
  `make bootstrap` once to install the locked Node dependency graph.
- `make verify` is the fast inner loop after bootstrap; `make validate` adds
  network-backed vulnerability checks and license policy.
- The pinned k6 executable is a prerequisite for workload validation and tests;
  the runner image remains a separate Docker-dependent check.
- Runtime/tooling imports are checked mechanically so Node-only modules cannot
  leak into k6 scenario code.
- Unavailable checks are reported as not run, never weakened or claimed as
  passed.

## Purpose

The harness combines feed-forward safety guidance with deterministic feedback.
It keeps target authorization, load bounds, workload identity, evidence, and
tooling boundaries visible before changes and executable afterward. The root
[Makefile](../../Makefile), `package.json`, and CI workflows form the command
surface.

## Cost tiers

| Tier             | Timing                | Commands and dependencies                                                                                   |
| :--------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------- |
| T0 — route       | Before editing        | CONTRIBUTING plus relevant rows in the documentation map.                                                   |
| T1 — inner loop  | During implementation | Focused Node tests, then `make verify`; offline after npm bootstrap when the pinned k6 binary is installed. |
| T2 — acceptance  | Before handoff        | `make validate`; vulnerability data may require network access.                                             |
| T3 — specialized | Image-affecting work  | `make image`; requires Docker and builds the Linux AMD64 runner.                                            |

Cost does not make an applicable check optional. Follow the
[constrained-environment protocol](../../CONTRIBUTING.md#verification-and-constrained-environments)
when a check cannot run.

## Command inventory

| Command                   | Evidence produced                                                                                |
| :------------------------ | :----------------------------------------------------------------------------------------------- |
| `make bootstrap`          | Exact dependencies from `package-lock.json` are installed without lifecycle scripts.             |
| `make doctor`             | Git, Node, npm, k6, and Make versions are reported.                                              |
| `make docs-check`         | Local documentation links, TL;DR policy, ADR structure, and contribution templates are coherent. |
| `make architecture-check` | k6 runtime sources do not depend on Node-only tooling or npm packages.                           |
| `make check`              | Formatting, repository policy, runtime boundaries, and all workload definitions are valid.       |
| `make test`               | Loopback runner, manifest, contract, image-policy, and harness tests pass.                       |
| `make verify`             | Checks and tests close the portable inner loop.                                                  |
| `make supply-chain`       | Locked dependencies satisfy vulnerability and license policy.                                    |
| `make validate`           | The complete non-image acceptance aggregate passes.                                              |
| `make image`              | The Linux AMD64 runner image builds and its identity and inventory verify.                       |

`make bootstrap` does not silently download an executable into PATH. Install
the exact version from `.k6-version` through a reviewed platform mechanism; CI
uses an explicit pinned-version installation step and verifies the archive with
the checked-in `.k6-linux-amd64.sha256`. This keeps local setup transparent and
avoids an unchecked downloader in the repository.

## Steering the harness

When a review finding or escaped defect recurs, clarify the narrow canonical
guide, add the cheapest deterministic structural sensor, add a behavioral
regression fixture, or record an explicit reviewed exception when automation
would be misleading. New sensors MUST be actionable, deterministic at their
tier, tested on failures, and included in an aggregate command.
