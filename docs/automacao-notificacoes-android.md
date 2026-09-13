# Guia de Captura Automática de Notificações Bancárias (Android)

Este guia apresenta as **melhores alternativas 100% gratuitas e de código aberto** para substituir o MacroDroid e capturar notificações bancárias no Android sem pagar nada.

---

## Opção 1: Automate (LlamaLab) — Recomendado (Gratuito na Play Store)
O **Automate** é muito superior ao MacroDroid, moderno, gratuito e usa blocos visuais de fluxo (flowcharts). A versão gratuita permite até 30 blocos por fluxo (a nossa automação precisa de apenas 3 blocos!).

### Passo a Passo no Automate:
1. Instale o **Automate** na Play Store (ícone de labirinto/engrenagens azuis).
2. Abra o app, clique no botão **+** para criar um novo fluxo.
3. No painel de blocos:
   - Adicione o bloco **Apps** -> **Notification posted?** (Gatilho quando chega notificação).
     - Toque nele e selecione os apps dos seus bancos (*Nubank*, *Inter*, etc.).
     - No campo **Title**, declare uma nova variável: `not_title`.
     - No campo **Message / Text**, declare uma nova variável: `not_text`.
     - No campo **Package name**, declare: `not_app`.
   - Conecte a saída "YES" no próximo bloco:
   - Adicione o bloco **Connectivity** -> **HTTP request**:
     - **Request URL:** `https://finapp.zt/api/v1/webhooks/bank-notification` (ou `https://172.23.17.157/api/v1/webhooks/bank-notification`)
     - **Request method:** `POST`
     - **Request content type:** `JSON`
     - **Request content:**
       ```json
       {
         "app_name": not_app,
         "title": not_title,
         "text": not_text
       }
       ```
   - Conecte a saída do HTTP de volta na entrada do bloco de notificação (criando um loop contínuo de escuta).
4. Salve e clique em **Start**.

---

## Opção 2: Termux + Termux:API (100% Open Source / Sem Limites)
Para quem prefere uma solução **100% livre, sem anúncios e de código aberto** disponível no F-Droid:

1. Instale o **Termux** e o **Termux:API** pelo F-Droid.
2. No Termux, execute um script leve em bash ou python que escuta notificações do sistema via `termux-notification-list` e envia o payload para o FinApp via curl.

---

## Opção 3: Tasker (Se já tiver licença paga)
Se você já tiver o Tasker:
- **Event:** `UI -> Notification` (Owner Application: Nubank, Inter, etc.).
- **Action:** `Net -> HTTP Request` (Method: POST, URL: `https://finapp.zt/api/v1/webhooks/bank-notification`, Body: `{"app_name": "%evtpkg", "title": "%evttitle", "text": "%evttext"}`).

---

## Testando o Webhook Manualmente:
Você pode testar a qualquer momento pelo terminal da sua VM ou pelo PC com o comando:

```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 42,90 aprovada em Supermercado Bom Preço"}'
```

Ao abrir o FinApp, o card amarelo de alerta aparecerá instantaneamente com a compra detectada pronta para aprovação!