IMAGE ?= perfeng-k6:local-check

.PHONY: help fmt fmt-check check test validate image

help:
	@echo perfeng-k6 engineering command surface
	@echo "  make fmt        Format repository-owned text and source files"
	@echo "  make fmt-check  Verify formatting without changing files"
	@echo "  make check      Run formatting and workload-definition checks"
	@echo "  make test       Run the Node integration and contract tests"
	@echo "  make validate   Run all portable non-image checks"
	@echo "  make image      Build and verify IMAGE (default: perfeng-k6:local-check)"

fmt:
	npm run format

fmt-check:
	npm run format:check

check: fmt-check
	npm run validate

test:
	npm test

validate: check test

image:
	docker build -t $(IMAGE) .
	npm run image:verify -- $(IMAGE)
