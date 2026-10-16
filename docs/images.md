# Runner image publication

## TL;DR

- Build and verify the Linux AMD64 runner locally before publication.
- Publish only from the manual workflow on `main` and promote only its verified immutable GHCR
  digest.
- The image runs as UID/GID 12345 and contains no Node tooling, credentials or result data.
- Private GHCR images require separate pull credentials for kind/Kubernetes nodes.
- Publication does not change package visibility, sign the image or deploy a workload.

The environment must use the registry manifest digest of the runner image,
not the k6 base digest, a mutable tag, or Docker's local image/config ID.
This slice produces that prerequisite; it does not launch Kubernetes Jobs or
upload measurements.

## Build and validate locally

```sh
make bootstrap
make image
```

Set `IMAGE=registry/name:tag` when the default
`perfeng-k6:local-check` name is unsuitable.

Use a fresh tag if that local tag already identifies work you need to preserve.
Verification runs containers with networking disabled, a read-only root filesystem,
all capabilities dropped, and privilege escalation disabled. It checks the k6
version, non-root user, working directory/entrypoint, hashes of every packaged
runtime file, workload configuration hashes, and native inspection of all 12
scenario/profile combinations. It does not run load against a target. It also
checks that an injected `K6_VUS` option is rejected by the image before load.

The base is grafana/k6 2.2.0 pinned to the OCI index digest recorded in Dockerfile,
resolved on 2026-09-02. Updating it requires reviewing the pin and running checks.
The final image contains the scenario libraries, tests, workloads, definitions,
and .k6-version. It does not contain Node tooling, credentials, or local results.
The image runs as UID/GID 12345; a mounted results directory must be writable
by that identity. It does not gain root privileges to repair host permissions.

## Publish through GitHub Actions

After this change is on main, open the repository's Actions page and select
Build and optionally publish runner image. Run it from main:

- Leave publish unchecked to build and test without registry authentication/push.
- Check publish to authorize publication to the repository's GHCR package.

The workflow builds Linux AMD64, records the source revision, verifies image
contents, extracts the pinned k6 executable for the full source test suite,
and only then authenticates and pushes. PRs, feature branches, and ordinary
pushes do not publish. The validation workflow still builds/checks PR images.
Source revision labels identify the checkout; they are not cryptographic attestations.

Publication uses the repository-scoped GitHub token, not a committed or manually
created PAT. The image tag includes the commit, workflow run, and attempt to avoid
retagging another run. After push, the workflow resolves a registry manifest
digest, pulls by that digest, verifies the image again, and prints the exact
GHCR reference plus source revision/platform in the Actions summary.

Copy that exact reference into the environment's future deployment configuration.
Build-only runs intentionally provide no registry reference. A failed post-push
verification may leave a registry image: do not promote it from a failed run.
The workflow does not delete packages, sign images, or claim reproducible builds.

## Registry access

First-time GHCR packages are private by default. Keep that default unless you
explicitly decide to publish the code/image contents. A private package requires
appropriate Kubernetes image-pull credentials; a public package permits anonymous
pulls. The workflow never changes package visibility or creates cluster Secrets.
Existing packages may require granting the repository Actions access before push.
Organization policies can also restrict package publication.

Containerd/Docker authentication on your workstation does not automatically grant
kind nodes access to private GHCR images. Image-pull access and the exact verified
digest must be resolved before the environment can execute this runner.

This initial publication targets Linux AMD64 only; do not schedule it on ARM64.
Multi-platform publication, signed attestations, and production scanning/promotion
policy remain subsequent work.

References: [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
