# Guia de Captura Automática de Notificações Bancárias (Android)

Este guia apresenta as **melhores alternativas 100% gratuitas e de código aberto** para substituir o MacroDroid e capturar notificações bancárias no Android sem pagar nada.

---

## 1. Como Funciona a Integração
Sempre que uma compra no cartão de crédito/débito ou transferência Pix é realizada, o aplicativo do seu banco emite uma notificação no Android. O aplicativo de automação captura essa notificação e dispara um webhook seguro diretamente para a sua VM Linux via ZeroTier (`https://finapp.zt`).

O FinApp analisa o texto, extrai o **valor** e o **estabelecimento**, vincula à sua conta correspondente e coloca o gasto como **Pendente de Confirmação** no topo do seu Dashboard para você categorizar e aprovar com 1 toque!

---

## Opção 1: Automate (LlamaLab) — Com Fila Offline (Recomendado)
O **Automate** é moderno, 100% gratuito e usa blocos visuais de fluxo (flowcharts). A versão gratuita permite até 30 blocos.

Como a sua VM fica acessível apenas na VPN (ZeroTier), criaremos uma **Fila (Buffer)**. Quando você receber uma notificação fora de casa/sem VPN, o Automate salvará a notificação localmente. Quando a VPN conectar, ele enviará todas as notificações pendentes de uma vez em lote (array JSON) para o FinApp.

### Passo a Passo da Lógica no Automate:
1. Instale o **Automate** na Play Store.
2. Inicie um novo Fluxo (+) e crie a seguinte estrutura circular:

#### Parte 1: Escuta e Armazenamento (Offline)
*   **Bloco 1: Notification posted?**
    *   *Package*: Selecione os apps dos seus bancos.
    *   *Output Variables*: `not_title` (Title), `not_text` (Message), `not_app` (Package name).
*   **Bloco 2: File read text** (Após receber a notificação, lê o arquivo de fila)
    *   *File*: `"/storage/emulated/0/Download/finapp_queue.json"` (Exemplo)
    *   *Output variable*: `queue_content` (Se o arquivo não existir, tratar no bloco de expressão).
*   **Bloco 3: Variable set** (Adiciona a notificação na fila)
    *   *Variable*: `updated_queue`
    *   *Value*: `jsonEncode( arrayConcat( jsonDecode(queue_content ? queue_content : "[]"), [{"app_name": not_app, "title": not_title, "text": not_text}] ) )`
*   **Bloco 4: File write text** (Salva a fila atualizada)
    *   *File*: `"/storage/emulated/0/Download/finapp_queue.json"`
    *   *Text*: `updated_queue`

#### Parte 2: Tentativa de Envio (Online)
*   Após gravar no arquivo, ligue o fluxo ao **Bloco 5: Ping** (Ou *Host address resolve* para `finapp.zt`) para checar se a VPN/Servidor está acessível.
    *   *NO (Fora da VPN)*: Ligue de volta ao **Bloco 1** (Volta a escutar).
    *   *YES (Na VPN)*: Vá para o **Bloco 6: HTTP request**.
*   **Bloco 6: HTTP request**
    *   *Request URL*: `https://finapp.zt/api/v1/webhooks/bank-notification` (ou IP da VM)
    *   *Method*: `POST`
    *   *Content type*: `JSON`
    *   *Request content*: `updated_queue`
    *   *Output status code*: `http_status`
*   **Bloco 7: Expression true?** (Checa se deu sucesso)
    *   *Formula*: `http_status = 201`
    *   *YES*: Vá para o **Bloco 8: File write text** (Grava um texto em branco `[]` no arquivo para esvaziar a fila), e depois ligue de volta ao **Bloco 1**.
    *   *NO*: Ligue de volta ao **Bloco 1** (mantém os itens na fila para tentar depois).

Dessa forma, se a VPN estiver desligada, ele só preenche o arquivo JSON no celular. Assim que a VPN ligar e uma nova notificação chegar (ou você pode adicionar um gatilho de mudança de rede para tentar sincronizar), ele envia a lista completa para o servidor. O FinApp já suporta receber a notificação única ou o Array/Lote.

---

## 2. Comandos de Teste do Webhook (Cenários Reais do Nubank e Bancos)

Você pode simular e testar todos os tipos de notificações bancárias diretamente do terminal da sua VM Linux ou pelo PowerShell/Prompt do Windows (usando `curl`):

### Teste 1: Compra no Cartão de Crédito Nubank
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra de R$ 68,40 aprovada em Supermercado Extra"}'
```

### Teste 2: Compra no Débito Nubank
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra no débito", "text": "Você pagou R$ 15,00 no débito em Padaria Santo Pão"}'
```

### Teste 3: Compra por Aproximação (Contactless)
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Compra aprovada", "text": "Compra por aproximação de R$ 32,50 no Restaurante Sabor Brasil"}'
```

### Teste 4: Transferência Pix Enviada
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Nubank", "title": "Transferência enviada", "text": "Você transferiu R$ 120,00 para Maria da Silva"}'
```

### Teste 5: Notificação do Banco Inter
```bash
curl -k -X POST https://finapp.zt/api/v1/webhooks/bank-notification \
  -H "Content-Type: application/json" \
  -d '{"app_name": "Inter", "title": "Compra confirmada", "text": "Compra no cartão de crédito de R$ 89,90 aprovada em Posto Ipiranga"}'
```

---

## 3. O que acontece após disparar o comando:
1. O FinApp responderá com `201 Created`:
   ```json
   {
     "success": true,
     "message": "Transação capturada com sucesso!",
     "transaction": { "description": "Supermercado Extra", "amount": "68.40", "statusId": 2 }
   }
   ```
2. Ao abrir o **FinApp** (`https://finapp.zt`), você verá imediatamente o banner amarelo piscando no topo do Dashboard com o aviso de compras pendentes para revisar e aprovar!