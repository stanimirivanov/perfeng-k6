FROM grafana/k6:2.2.0
WORKDIR /tests
COPY lib/ ./lib/
COPY tests/ ./tests/
COPY workloads/ ./workloads/
ENTRYPOINT ["k6"]
CMD ["run", "--no-usage-report", "--config", "workloads/smoke/checkout.json", "--summary-export", "/results/summary.json", "--out", "json=/results/points.jsonl", "tests/checkout/scenario.js"]
