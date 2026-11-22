# k6 runner language

Terms for reproducible API load generation and raw capture. Shared terms are defined in the [Perfeng glossary](https://github.com/stanimirivanov/perfeng-contracts/blob/main/GLOSSARY.md).

## Language

**API Scenario**
A named API transaction or journey executed as part of a load workload.

**Load Profile**
The native load configuration for one workload purpose, including its scheduling model and phase budgets.

**Open Load Model**
A workload model in which arrivals are scheduled independently of prior iteration completion.

**Closed Load Model**
A workload model in which a worker starts its next iteration after the previous one finishes.

**Summary**
The original aggregate output from k6 for a capture.

**Sample Points**
The original per-observation output retained alongside the Summary.

**Runner Threshold**
A condition evaluated by k6 as part of the capture. Its outcome is raw execution evidence with its own tool exit status.

**Workload Configuration Hash**
The identity of the exact reviewed profile bytes. An execution’s resolved overrides are recorded separately.
