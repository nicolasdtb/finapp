# Backup e restauração

## Como funciona hoje
- Todo dia às 03:45 (cron do usuário `ubuntu` na VM) roda `~/backup-finapp.sh`.
- Gera um dump do Postgres (`pg_dump -Fc`), confere que é legível e não está vazio, copia para o
  Google Drive criptografado (`rclone`, remoto `gcrypt:finapp-db`) e confere que chegou.
- O `.env` também vai criptografado (`gcrypt:finapp-env`).
- Mantém 30 dias. O Healthchecks avisa se o backup falhar ou deixar de rodar.
- Log: `~/backup-finapp.log`.

## Testar a restauração (sem tocar no banco em uso)
```
bash ~/finapp/scripts/restore-test-finapp.sh
```
Baixa o dump mais recente, restaura num banco temporário (`finapp_restore_test`), compara a contagem
de linhas com a produção e apaga o temporário. Deve terminar com `RESTAURACAO OK`. Faça isso de tempos
em tempos (ex.: uma vez por mês): backup que nunca foi restaurado não é garantia.

## Restaurar de verdade (VM nova ou banco perdido)
1. Instale Docker e `rclone`, recupere a configuração do `rclone` (remotos `gdrive` e `gcrypt`, com a
   senha da criptografia) e clone o repositório em `~/finapp`.
2. Baixe o `.env` mais recente: `rclone ls gcrypt:finapp-env` e `rclone copy gcrypt:finapp-env/<arquivo> /tmp/`;
   copie para `~/finapp/.env`.
3. Suba só o banco: `cd ~/finapp && sudo docker compose up -d postgres`.
4. Baixe o dump: `rclone copy gcrypt:finapp-db/<arquivo>.dump /tmp/`.
5. Restaure: `sudo docker exec -i finapp_db pg_restore -U <DB_USER> -d <DB_NAME> --clean --if-exists --no-owner < /tmp/<arquivo>.dump`
6. Suba o resto: `sudo docker compose up -d --build`.

Guarde a senha da criptografia do `rclone` fora da VM (gerenciador de senhas). Sem ela, os backups
no Drive não podem ser lidos.
