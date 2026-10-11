#!/bin/bash
# Teste de restauracao do backup do FinApp.
# Baixa o dump mais recente do Drive (rclone gcrypt), restaura num banco TEMPORARIO
# (o banco em uso nao e tocado), compara a contagem de linhas e apaga o temporario.
set -Eeuo pipefail
APP=~/finapp
TEST_DB=finapp_restore_test
DB_USER=$(grep -m1 '^DB_USER=' "$APP/.env" | cut -d= -f2-)
DB_NAME=$(grep -m1 '^DB_NAME=' "$APP/.env" | cut -d= -f2-)
TMP=$(mktemp -d)
psql_in() { sudo docker exec -i finapp_db psql -U "$DB_USER" -d "$1" -tAc "$2"; }
cleanup() {
  sudo docker exec finapp_db dropdb -U "$DB_USER" --if-exists "$TEST_DB" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

LATEST=$(rclone lsf gcrypt:finapp-db | sort | tail -n 1)
[ -n "$LATEST" ] || { echo "Nenhum backup encontrado no Drive."; exit 1; }
echo "Backup mais recente: $LATEST"
rclone copy "gcrypt:finapp-db/$LATEST" "$TMP"

sudo docker exec finapp_db dropdb -U "$DB_USER" --if-exists "$TEST_DB"
sudo docker exec finapp_db createdb -U "$DB_USER" "$TEST_DB"
sudo docker exec -i finapp_db pg_restore -U "$DB_USER" -d "$TEST_DB" --no-owner < "$TMP/$LATEST"

echo
printf "%-16s %10s %10s\n" tabela restaurado producao
FAIL=0
for t in users accounts categories transactions; do
  r=$(psql_in "$TEST_DB" "select count(*) from $t")
  p=$(psql_in "$DB_NAME" "select count(*) from $t")
  printf "%-16s %10s %10s\n" "$t" "$r" "$p"
  # restaurado deve ter dados e nunca mais que a producao (o dump e das 03:45)
  if [ "$r" -le 0 ] || [ "$r" -gt "$p" ]; then FAIL=1; fi
done
echo
if [ "$FAIL" -eq 0 ]; then echo "RESTAURACAO OK"; else echo "ATENCAO: contagens inesperadas"; exit 1; fi
