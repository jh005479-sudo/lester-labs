#!/usr/bin/env bash

set -euo pipefail

if test "$#" -eq 0; then
  echo "usage: verify-gh-attestation-with-retry.sh <gh attestation verify arguments...>" >&2
  exit 64
fi

result_file="$(mktemp "${RUNNER_TEMP:-/tmp}/gh-attestation-verification.XXXXXX")"
trap 'rm -f -- "$result_file"' EXIT

for attempt in 1 2 3; do
  if gh attestation verify "$@" >"$result_file"; then
    cat -- "$result_file"
    exit 0
  fi

  if test "$attempt" -eq 3; then
    echo "::error::GitHub attestation verification failed after three bounded attempts." >&2
    exit 1
  fi

  echo "::warning::GitHub attestation verification attempt $attempt failed; retrying." >&2
  sleep "$((attempt * 5))"
done
