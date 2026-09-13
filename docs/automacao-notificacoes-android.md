# Configuracao de Captura Automatica de Notificacoes Bancarias (Android)

Este guia ensina como integrar o **MacroDroid** (gratuito na Google Play Store) para ler notificações de compras do seu banco e enviar automaticamente para a sua VM Linux via ZeroTier.

---

## 1. Requisitos
- Celular Android com o **ZeroTier One** conectado na sua rede (IP da VM acessível).
- Aplicativo gratuito **MacroDroid** instalado pela Play Store.

---

## 2. Criando a Macro no MacroDroid

### Passo A: Gatilho (Trigger)
1. Abra o MacroDroid e clique em **Adicionar Macro**.
2. Clique no **+** vermelho em Gatilhos.
3. Escolha **Notificação** -> **Notificação Recebida**.
4. Selecione **Selecionar Aplicativo(s)**.
5. Marque seus aplicativos de bancos (ex: *Nubank*, *Banco Inter*, *Itaú*, *Bradesco*, etc.).
6. Deixe o conteúdo do texto como: *Qualquer um* e dê OK.

---

### Passo B: Ação (Action)
1. Clique no **+** azul em Ações.
2. Escolha **Conectividade** -> **Abrir Site / Obter HTTP**.
3. Configure como **HTTP POST**:
   - **URL:** `http://172.23.17.157:3001/api/v1/webhooks/bank-notification`
   - **Content-Type:** `application/json`
   - **Corpo da Requisição (Body):**
     ```json
     {
       "app_name": "[not_app_name]",
       "title": "[not_title]",
       "text": "[not_body]"
     }
     ```
     *(Você pode clicar no botão de reticências/tag ao lado do campo de texto para selecionar as variáveis de notificação do MacroDroid).*
4. Dê OK.

---

### Passo C: Salvar
Dê o nome da Macro como `FinApp - Gastos Bancários` e salve.

---

## 3. Como testar manualmente via curl (do terminal ou celular):
Para simular que uma compra aconteceu no cartão sem precisar gastar dinheiro:
```bash
curl -X POST http://172.23.17.157:3001/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra Aprovada", "text": "Compra de R$ 38,50 aprovada no Restaurante Sabor Brasil"}'
```
Ao abrir o **FinApp** no navegador, você verá imediatamente o banner amarelo:
`"1 gasto bancário detectado - Supermercado/Restaurante - Toque para categorizar e aprovar"`.
