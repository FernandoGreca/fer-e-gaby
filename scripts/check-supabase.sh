#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?Configure SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Configure SUPABASE_PUBLISHABLE_KEY}"

# Public GET requests only. Never use an administrative key or a user session.
for table in wishlists gallery_photos; do
  response=$(curl --silent --show-error --fail \
    --connect-timeout 10 --max-time 20 \
    --retry 2 --retry-delay 3 --retry-max-time 70 \
    --header "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    --header 'Accept: application/json' \
    "${SUPABASE_URL%/}/rest/v1/${table}?select=id&limit=1")

  # Empty tables are healthy too; HTML/error objects must fail the check.
  if ! jq --exit-status \
    'type == "array" and length <= 1 and all(.[]; type == "object" and (.id | type == "string"))' \
    <<< "$response" >/dev/null; then
    echo "Invalid response from ${table}" >&2
    exit 1
  fi
  echo "OK: ${table} answered a public read query."
done

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo 'Supabase respondeu às consultas públicas de listas e galeria. Nenhum dado foi modificado.' >> "$GITHUB_STEP_SUMMARY"
fi
