# k6 runner documentation map

## TL;DR

- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for workflow policy, then use this
  map to load only the guidance relevant to the task.
- The root [README](../README.md) defines product ownership and supported
  behavior; workload and raw-manifest guides own their detailed semantics.
- Development guides explain implementation and verification practice without
  overriding workload identity, safety rules, or accepted decisions.
- Update this map when a canonical guide moves or a recurring task gains a new
  source of truth.

## Route by task

| Task or changed boundary                                | Read first                                                                                           | Verify or consult                                 |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| Contributor workflow or issue preparation               | [CONTRIBUTING.md](../CONTRIBUTING.md)                                                                | [Harness guide](development/harness.md)           |
| Build, CI, repository policy, or local setup            | [Harness guide](development/harness.md), [developer quickstart](development/developer-quickstart.md) | `make docs-check`, `make verify`, `make validate` |
| JavaScript, k6 scenarios, or runtime/tooling boundaries | [Engineering standards](development/engineering-standards.md)                                        | `make architecture-check`, `make verify`          |
| Workload profiles, definitions, hashes, or load shape   | [Workload guide](../workloads/README.md)                                                             | `npm run validate`, scenario fixture tests        |
| Raw evidence or manifest assembly                       | [Raw-manifest guide](raw-manifests.md)                                                               | Contract and manifest tests                       |
| Runner image or publication                             | [Image guide](images.md)                                                                             | `make image`                                      |
| Dependency, license, or vulnerability changes           | [Dependency policy](development/dependency-policy.md)                                                | `make supply-chain`                               |
| Durable technical decision                              | [ADR index](decisions/README.md)                                                                     | ADR template and supersession rules               |
| Extraction history or provenance                        | [Migration provenance](migration-provenance.md)                                                      | Source and contract locks                         |
| Vulnerability reporting                                 | [SECURITY.md](../SECURITY.md)                                                                        | Repository owner                                  |

## Authority

[CONTRIBUTING.md](../CONTRIBUTING.md) is canonical workflow policy.
[AGENTS.md](../AGENTS.md) is the concise tool-facing entry point. The root
[README](../README.md), workload guide, and raw-manifest guide define supported
behavior in their boundaries. Accepted ADRs govern their decisions until
superseded.

Read only the rows relevant to the task. Do not bulk-load unrelated guides or
future ADRs. Surface conflicts through CONTRIBUTING's ambiguity protocol.

## Keeping the map current

A change MUST update this page when it adds, renames, moves, or removes a
canonical document or creates a recurring task without a clear route.
`make docs-check` validates local links and mechanical policy; semantic accuracy
still requires review.
