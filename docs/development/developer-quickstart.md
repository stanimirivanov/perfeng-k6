# k6 runner developer quickstart

## TL;DR

- Install Git, GNU Make, Node from `.node-version`, and k6 from `.k6-version`.
- Run `make bootstrap`, `make doctor`, and `make verify`.
- Run `make validate` before handoff and `make image` when runtime image inputs
  change.
- Automated tests generate load only against their ephemeral loopback fixture.

## Setup and daily loop

From the repository root:

```sh
make bootstrap
make doctor
make verify
```

`make bootstrap` executes `npm ci --ignore-scripts`; it never runs dependency
lifecycle scripts. The k6 executable remains an explicit prerequisite and must
match `.k6-version`.

While editing, run a focused Node test where practical, then:

```sh
make fmt
make verify
```

Formatting changes files and must be reviewed. Before handoff run
`make validate`. Scenario, profile, definition, Dockerfile, or image-inventory
changes also run `make image` with Docker available.

## Troubleshooting

- Use `make doctor` to identify a missing or mismatched tool.
- Re-run `make bootstrap` after `package.json` or `package-lock.json` changes.
- Do not forward developer `K6_*`, credentials, or external target settings into
  fixture tests.
- Keep captures in new ignored or temporary directories; never overwrite prior
  evidence as recovery.
- Report an unavailable required check using CONTRIBUTING's constrained-
  environment protocol.
