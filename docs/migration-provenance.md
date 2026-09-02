# Source provenance

Source repository: performance-platform.
Source commit: 57c1b5074898d4d86476e8b4f99c19eff3a77018.
Source subtree: tests/k6/.

- tests/, workloads/, and lib/metrics.js originate in that subtree.
- lib/config.js is reduced to the helpers used by the extracted scenarios.
- The original catalogue.yaml is retained as legacy/catalogue.yaml. It lacks
  the artifact pins and shape required by the current catalogue contract.
- The unused lib/http.js was not carried into active code: it imports an
  untracked checks.js and references unimported getApiUrl and sleep functions.
  Other untracked helper files were not treated as committed source.
- package.json and Dockerfile are replaced with standalone tooling and packaging.
- The existing destination LICENSE is preserved; both repositories use Apache 2.0.

Scenario-level options were removed so native profile configuration controls
load and thresholds. Checkout now counts cart failure and missing/malformed order
IDs as transaction failures; account now counts preference-update failure.
Thinking time is configurable and defaults to one second. Account identifiers
use VU/iteration identity for repeatable fixture paths, not production account
provisioning. Existing profile values and raw metric names remain unchanged.

The source subtree is deliberately retained until its consumers migrate.
This document records provenance, not proof that Git ancestry has been imported.
History import is an owner-operated prerequisite to completing extraction.
