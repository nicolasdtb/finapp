# Conexao ao Banco de Dados com DBeaver

Como o FinApp roda com Docker na sua VM Linux conectada via **ZeroTier**, voce pode conectar o DBeaver diretamente a partir do seu PC Windows para suporte, criacao de views e analise de dados!

---

## Passo a Passo para Conectar:

1. **Abra o DBeaver no seu computador.**
2. Clique no botao **Nova Conexao** (icone de tomada com +) e selecione **PostgreSQL**.
3. Preencha os parametros com os dados do seu arquivo `docker-compose.yml`:
   - **Host:** O IP do ZeroTier da sua VM Linux (exemplo: `10.147.17.50`)
   - **Port:** `5432`
   - **Database:** `finapp`
   - **Username:** `finapp_user`
   - **Password:** `finapp_password`
4. Clique em **Test Connection** (Testar Conexao).
5. Clique em **Finish**.

---

## Tabelas de Lookup (Dicionario) no DBeaver
Ao navegar pelas tabelas no DBeaver, voce vera as tabelas de lookup:
- `account_types`: veja os IDs (1 = Conta Corrente, 2 = Cartao de Credito...)
- `transaction_types`: veja os IDs (1 = Receita, 2 = Despesa, 3 = Transferencia...)
- `transaction_statuses`: veja os IDs (1 = Confirmado, 2 = Pendente de Aprovacao...)
- `recurrence_types`: veja os IDs (1 = Unica, 4 = Mensal, 6 = Parcelada...)

Isso permite fazer queries SQL faceis com `JOIN` e entender claramente o significado de qualquer campo sem consultar codigo fonte.
