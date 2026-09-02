FROM grafana/k6:2.2.0@sha256:9bd01d6941fca969cb61bb57d2da5ee9b385fe2aa8881df3798c196564d6ace6
ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/stanimirivanov/perfeng-k6" \
      org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.title="perfeng-k6"
WORKDIR /tests
COPY .k6-version ./.k6-version
COPY lib/ ./lib/
COPY tests/ ./tests/
COPY workloads/ ./workloads/
COPY definitions/ ./definitions/
USER 12345:12345
ENTRYPOINT ["k6"]
CMD ["run", "--no-usage-report", "--config", "workloads/smoke/checkout.json", "--summary-export", "/results/summary.json", "--out", "json=/results/points.jsonl", "tests/checkout/scenario.js"]
