# Native k6 workload profiles

Each JSON file is a native k6 --config input. registry.json lists the supported
scenario/profile combinations; its descriptions and typical rates are descriptive,
not executable defaults. The scenario JSON file is authoritative.

The extracted profiles are unchanged prototype configurations. They have not
been calibrated as production performance policies. k6 thresholds affect the
process exit code, not the platform's independent quality/SLO/regression verdicts.

Use the standalone wrapper documented in the root README, for example:

```sh
npm run run -- checkout smoke ./fresh-checkout-output
```

Available profiles: smoke, average, regression, stress, capacity. Not every
scenario supports every profile; the wrapper rejects unsupported combinations.

Checkout profiles use ramping-arrival-rate and search profiles use
constant-arrival-rate: both are open models. Account profiles use ramping-vus,
a closed model whose achieved request rate can fall as response time grows.
Inspect dropped iterations and achieved arrival rate before trusting open-model
measurements; configuration alone does not prove the requested load was delivered.

To add a profile, add its scenario JSON and registry entry, then run npm run
validate and npm test. Scenario source must not export options that shadow the
chosen profile.

The matching definitions/<profile>/<scenario>.json documents implement workload/v1.
They pin configuration bytes and record model, phase budgets, and dataset.kind:
none (no separately versioned dataset). Native profiles and this registry are
not substitutes for those contracts. Changes to configuration, phases, model,
or dataset require a new workload version and updated checksums.

All current profiles include their ramps in measurement. No warm-up/cooldown
samples are excluded. The declared measurement budget is the executor duration
or sum of stage durations, not the process lifetime; graceful stopping can take
additional time. The manifest window must be observed separately.
