# SplitKesh Monitoring (Prometheus + Grafana)

Self-hosted metrics for the SplitKesh API using Prometheus (collection) and
Grafana (dashboards). Everything runs in Docker; your API keeps running on the
host as usual.

## How it fits together

```
  API (host :5000) ──/metrics──>  Prometheus (:9090) ──query──>  Grafana (:3001)
```

- The API exposes Prometheus metrics at `GET /metrics` (added via
  `api/middleware/metrics.js`). It includes default Node/process metrics plus
  custom `http_requests_total` and `http_request_duration_seconds`.
- Prometheus scrapes that endpoint every 15s.
- Grafana auto-loads the Prometheus datasource and the "SplitKesh API" dashboard.

## Prerequisites

- Docker Desktop installed and running.
- The API running with the new metrics code:
  ```bash
  cd api
  npm install        # installs prom-client
  npm run dev        # serves /metrics on :5000
  ```
  Verify: open http://localhost:5000/metrics — you should see plain-text metrics.

## Run the stack

From this `monitoring/` folder:

```bash
docker compose up -d
```

Then open:

- Prometheus: http://localhost:9090
  - Status → Targets should show `splitkesh-api` as **UP**.
- Grafana: http://localhost:3001  (login `admin` / `admin`)
  - Dashboards → "SplitKesh API" is already provisioned.

Stop / remove:

```bash
docker compose down            # stop
docker compose down -v         # stop and wipe stored metrics/dashboards
```

## Notes & troubleshooting

- **Grafana port is 3001**, not 3000, so it doesn't clash with the React app.
- **Target shows DOWN in Prometheus:** make sure the API is running on the host
  and `http://localhost:5000/metrics` works. Prometheus reaches the host via
  `host.docker.internal` (configured in `prometheus/prometheus.yml`).
- **Running the API itself inside Docker?** Put it on the same compose network
  and change the Prometheus target from `host.docker.internal:5000` to your
  service name, e.g. `api:5000`.
- **Securing /metrics:** set `METRICS_TOKEN=something` in `api/.env`, then
  uncomment the `authorization` block in `prometheus/prometheus.yml` with the
  same value. Otherwise the endpoint is open (fine for local use).
- **Change the Grafana password:** edit `GF_SECURITY_ADMIN_PASSWORD` in
  `docker-compose.yml` before first run, or change it in the UI.

## Files

```
monitoring/
├── docker-compose.yml
├── prometheus/
│   └── prometheus.yml
└── grafana/
    ├── provisioning/
    │   ├── datasources/datasource.yml      # auto-connects Prometheus
    │   └── dashboards/dashboards.yml       # loads dashboards from disk
    └── dashboards/
        └── splitkesh.json                  # the dashboard
```
