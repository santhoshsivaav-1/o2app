#!/bin/sh
# Phase 1 skeleton — full logic lands Phase 10
set -eu
API="${API_URL:-http://localhost:4000/api/v1}"
curl -fsS "$API/health/live" && curl -fsS "$API/health/ready"
