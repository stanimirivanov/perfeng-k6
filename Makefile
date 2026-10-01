IMAGE ?= perfeng-k6:local-check
NPM ?= npm

.PHONY: help bootstrap doctor fmt fmt-check docs-check architecture-check check test verify vuln license supply-chain validate image

help:
	@echo perfeng-k6 engineering command surface
	@echo "  make bootstrap  Install the exact locked Node dependencies"
	@echo "  make doctor  Report Git, Node, npm, k6 and Make versions"
	@echo "  make fmt  Format repository-owned text and source files"
	@echo "  make fmt-check  Verify formatting without changing files"
	@echo "  make docs-check  Verify documentation and contribution policy"
	@echo "  make architecture-check  Verify k6 runtime/tooling import boundaries"
	@echo "  make check  Run deterministic formatting, policy and workload checks"
	@echo "  make test  Run Node integration, contract and harness tests"
	@echo "  make verify  Run the fast development feedback loop"
	@echo "  make supply-chain  Run vulnerability and license checks"
	@echo "  make validate  Run all portable non-image acceptance checks"
	@echo "  make image  Build and verify IMAGE (default: perfeng-k6:local-check)"

bootstrap:
	$(NPM) ci --ignore-scripts

doctor:
	@git --version
	@node --version
	@$(NPM) --version
	@k6 version
	@$(MAKE) --version

fmt:
	$(NPM) run format

fmt-check:
	$(NPM) run format:check

docs-check:
	$(NPM) run docs:check

architecture-check:
	$(NPM) run architecture:check

check: fmt-check docs-check architecture-check
	$(NPM) run validate

test:
	$(NPM) test

verify: check test

vuln:
	$(NPM) audit --audit-level=high

license:
	$(NPM) run licenses:check

supply-chain: vuln license

validate: verify supply-chain

image:
	docker build -t $(IMAGE) .
	$(NPM) run image:verify -- $(IMAGE)
