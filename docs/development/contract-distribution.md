# Preparing k6 contract updates

## TL;DR

- Prepare the reviewed contract bytes from the signed historical distribution.
- Retain a clean checkout and the signed inputs for offline rollback.
- Runner image contents, workload identities and runtime inputs stay pinned.

Stage the signed inputs and trusted verifier using the
[shadow setup](../raw-manifests.md#offline-contract-distribution-shadow). Preview
the reviewed selection, then prepare it into a fresh directory under an
operator-owned parent.

```sh
make contracts-update-check CONTRACTS_SHADOW_ASSETS="$assets" \
  CONTRACTS_BOOTSTRAP="$bootstrap" CONTRACTS_VERIFIER="$verifier"
node scripts/contract-distribution.mjs "$assets" "$bootstrap" "$verifier" "$staging/contracts"
```

Review the staged tree before using it as `vendor/contracts` in a build
checkout. The active selection remains 0.13.0. A different revision requires a
reviewed lock change and compatibility tests. Missing or invalid distribution
inputs stop preparation.

For rollback, retain the pre-cutover checkout and its reviewed commit, plus the
approved tool, contract assets and verifier. Export the retained checkout into a
fresh local directory and compare it with the staged candidate checkout.

```sh
make image IMAGE="$local_image"
make contracts-package-check IMAGE="$local_image" CONTRACTS_ROLLBACK_CHECKOUT="$rollback_checkout"
```

The package gate compares the rollback lock, vendored checksums and runner
inventory, then checks the actual candidate image with networking disabled.
The rehearsal covers distribution rollback at the same schema revision. The
runner image contains its workload and scenario inputs. Contract preparation
remains an operator tool outside the image.
