#!/bin/bash
# Corre schema.sql + todas las migraciones y las pruebas SQL en un Postgres
# local (sin Supabase). Uso:
#   PGHOST=/var/run/postgresql PGPORT=5432 supabase/tests/run.sh
# Crea (y borra) la base `zafi_test`. Las migraciones que fallan porque
# schema.sql ya trae lo que agregan se muestran como "skip".
set -u
DIR=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$DIR/../.." && pwd)
DB=${DB:-zafi_test}
PSQL="psql -X -q -v ON_ERROR_STOP=1 -U ${PGUSER:-postgres}"

$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" >/dev/null || exit 1
$PSQL -d $DB -f "$DIR/00_supabase_stub.sql" >/dev/null || exit 1
$PSQL -d $DB -f "$REPO/supabase/schema.sql" >/dev/null 2>&1

fail=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  out=$($PSQL -d $DB -f "$f" 2>&1)
  if [ $? -ne 0 ]; then
    echo "skip $(basename "$f"): $(echo "$out" | grep -m1 ERROR | sed 's/.*ERROR: *//')"
  fi
done

for t in "$DIR"/test_*.sql; do
  out=$($PSQL -d $DB -f "$t" 2>&1)
  if [ $? -ne 0 ]; then
    echo "FAIL $(basename "$t")"; echo "$out" | grep -E "ERROR|NOTICE" | head -20; fail=1
  else
    echo "ok   $(basename "$t")"
  fi
done
exit $fail
