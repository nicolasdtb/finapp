# 💸 FinApp — Inteligência Financeira Pessoal & Automação Bancária

<p align="center">
  <img src="https://img.shields.io/badge/Stack-React%20%7C%20Fastify%20%7C%20PostgreSQL-blue?style=for-the-badge" alt="Stack" />
  <img src="https://img.shields.io/badge/PWA-Ready-emerald?style=for-the-badge&logo=pwa" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Infra-Docker%20%2B%20ZeroTier-black?style=for-the-badge&logo=docker" alt="Docker + ZeroTier" />
  <img src="https://img.shields.io/badge/Security-Self--Hosted-purple?style=for-the-badge" alt="Self-Hosted" />
</p>

<p align="center">
  <b>FinApp</b> é uma plataforma moderna e completa de gestão financeira pessoal <i>self-hosted</i>, projetada para quem quer <b>controle absoluto do próprio dinheiro sem mensalidades, sem expor dados a terceiros e com automação em tempo real</b> direto do ecossistema bancário.
</p>

---

## ⚡ Por que o FinApp é Diferente?

A maioria dos apps de finanças te obriga a:
- Pagar assinaturas caras mensais;
- Entregar suas senhas bancárias via Open Finance para servidores de empresas terceiras;
- Lançar manualmente cafezinho por cafezinho todo santo dia.

O **FinApp** resolve isso com uma arquitetura soberana e automatizada:
1. **Captura Passiva em Tempo Real:** Conectado nativamente ao ecossistema Android através do [finapp-listener](https://github.com/nicolasdtb/finapp-listener), cada notificação de compra no cartão, débito ou Pix recebido (Nubank, Inter, etc.) cai no app **no segundo em que a maquininha aprova**.
2. **Scanner e Parser Inteligente de NFC-e (Nota Fiscal):** Aponte a câmera para o QR Code da nota fiscal do supermercado ou farmácia. O FinApp faz o scraping automático na SEFAZ e cadastra cada produto individualmente com quantidade, preço unitário e valor total.
3. **Ciclos Financeiros Inteligentes (Entre Salários / 5º Dia Útil):** O mês financeiro real não começa no dia 1º e termina no dia 30. O FinApp detecta a entrada do seu salário e calcula dinamicamente o período do seu ciclo para que suas metas e orçamentos reflitam a sua vida real.
4. **Transferências Neutras Entre Contas:** Mova dinheiro do Inter para o Nubank com um toque sem que isso infle artificialmente seus gráficos de despesa ou receita.
5. **100% Privado e Seguro:** Roda na sua própria VM ou servidor caseiro via Docker e rede privada ZeroTier/VPN. Seus dados financeiros nunca saem do seu controle.

---

## 🚀 Principais Funcionalidades

### 📱 1. Captura Instantânea de Notificações Bancárias
* Integrado ao webhook com o aplicativo dedicado [finapp-listener](https://github.com/nicolasdtb/finapp-listener).
* Transações detectadas entram no topo do Dashboard com status **Pendente de Confirmação**.
* Com um toque, você revisa, categoriza e aprova o lançamento, atualizando o saldo da conta na hora.

### 🧾 2. Detalhamento de Itens via QR Code de NFC-e
* Escaneie o QR Code de notas fiscais da SEFAZ direto pelo celular.
* O backend realiza a extração automatizada de todos os itens do cupom fiscal.
* Atribua **Tags e Categorias por produto individual** (ex: separar na mesma nota de mercado o que foi *Alimentação*, *Limpeza* ou *Bebidas*).

### 🔄 3. Gestão Multicontas & Transferências Internas
* Suporte a múltiplas contas correntes, cartões de crédito e carteiras físicas.
* **Transferência Interna (Tipo 3):** Movimentação atômica entre contas próprias (debita na origem, credita no destino) mantendo os relatórios de gastos imunes a falsos positivos.

### 🎯 4. Orçamentos com Burn-Rate & Inteligência Preditiva
* Defina limites de gastos mensais por categoria.
* **Cálculo de Ritmo de Queima (Burn-rate):** O FinApp avisa com precisão matemática: *"Nesse ritmo diário, seu orçamento de Lazer vai estourar no dia 18 do ciclo"*.
* **Navegação de Ciclos Futuros:** Planeje os tetos de gastos dos períodos subsequentes com antecedência.

### 📊 5. Relatórios Analíticos & Filtros Avançados
* Visão consolidada de Receitas, Despesas e Taxa de Poupança (% de economia do ciclo).
* Alternador de distribuição por **Categorias** ou por **Tags**.
* Agregação inteligente de tags: calcula o valor de tags na transação principal e tags de itens individuais sem dupla contagem.
* Filtros combinados por busca textual, categoria, conta e tags em tempo real.

### 💳 6. Cartões de Crédito, Faturas e Parcelamento
* Cada cartão tem limite, dia de fechamento e dia de vencimento (se cair em fim de semana ou feriado nacional, vale o próximo dia útil).
* Tela **Cartões** (abre ao tocar no card do cartão no Início): resumo, limite usado, faturas mês a mês (Aberta, Fechada, Vencida, Paga, Próxima), compras de cada fatura e pagamento da fatura com opção de desfazer.
* O saldo do cartão é a **dívida**, separada do saldo em contas. Pagar a fatura é uma transferência de uma conta para o cartão, e não conta como despesa.
* **Compras parceladas:** informe o valor total e o número de parcelas (até 24). O app cria uma parcela por fatura, e o total já consome o limite. Nos relatórios, cada parcela conta no mês dela.
* Apagar uma parcela pergunta se é só aquela ou todas da compra.

### 👥 7. Usuários, Convites e Webhook por Usuário
* O primeiro usuário de uma instalação vazia vira administrador. Os demais entram por **convite** (código de uso único, válido por 48 horas), gerado em Configurações > Conta. Limite de 3 usuários.
* Cada usuário tem o **próprio token de webhook** (Configurações > Conta), que pode ser regenerado. O webhook sem token é sempre recusado.
* Cada conta pode ser ligada ao app do banco que envia as notificações (Nubank, Banco Inter, Bradesco): compra no cartão cai no cartão e Pix cai na conta.
* O login tem limite de tentativas por IP e e-mail.

### ✋ 8. Conforto no Celular
* Nos lançamentos: deslize para a direita para confirmar um pendente e para a esquerda para excluir.
* Confirmação em lote dos pendentes que já têm categoria.
* Gráficos nos Relatórios: receitas e despesas dos últimos 6 ciclos, rosca por categoria e ritmo acumulado dos gastos contra o ciclo anterior.

### 💾 9. Backup
* Backup diário do banco, criptografado e enviado ao Google Drive, com retenção de 30 dias e alerta se falhar. Veja [docs/backup.md](docs/backup.md), que inclui o teste de restauração (`scripts/restore-test-finapp.sh`).

---

## 🛠️ Arquitetura e Stack Tecnológica

O FinApp foi desenhado sob uma arquitetura conteinerizada, moderna, rápida e resiliente:

```
                      [ Android: finapp-listener ]
                                   │ (HTTP POST Webhook)
                                   ▼
[ PWA / Mobile Browser ] ──▶ [ Nginx Reverse Proxy (SSL/PWA) ]
                                   │
                                   ▼
                         [ Fastify TypeScript API ]
                                   │
                                   ├──▶ [ Cheerio Web Scraper (NFC-e SEFAZ) ]
                                   └──▶ [ PostgreSQL 16 + Drizzle ORM ]
```

* **Frontend:**
  * **React 18 + TypeScript + Vite**
  * **TailwindCSS** (UI elegante com dark mode nativo e foco mobile-first)
  * **Lucide Icons**
  * **PWA (Progressive Web App):** Instalável na tela inicial do celular como aplicativo nativo.
* **Backend:**
  * **Node.js (LTS) + Fastify:** Alta performance e baixo consumo de memória.
  * **TypeScript:** Tipagem estrita de ponta a ponta.
  * **Drizzle ORM:** Queries SQL seguras, leves e declarativas.
  * **Zod:** Validação e sanitização rigorosa de payloads e webhooks.
  * **Cheerio:** Parser de HTML para scraping de notas fiscais estaduais (SEFAZ).
* **Banco de Dados:**
  * **PostgreSQL 16 (Alpine):** Integridade relacional com suporte a soft-deletes e índices performáticos.
* **Infraestrutura:**
  * **Docker Compose:** Orquestração completa de banco, API, frontend e DNS interno.
  * **ZeroTier:** Acesso remoto seguro de qualquer lugar sem necessidade de abrir portas no roteador residencial.

---

## 📦 Como Rodar o Projeto

### Pré-requisitos
* [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) instalados.
* Git.

### 1. Clonar o repositório
```bash
git clone https://github.com/nicolasdtb/finapp.git
cd finapp
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo ou crie seu `.env` na raiz do projeto:

```bash
cp .env.example .env
```
Preencha pelo menos `DB_PASSWORD`, `JWT_SECRET` (gere com `openssl rand -hex 32`) e `ZT_IP` (o IP da VM na rede ZeroTier, onde o frontend é publicado). O arquivo `.env.example` explica cada variável. `WEBHOOK_TOKEN` só é usado na primeira subida, para o usuário mais antigo; depois cada usuário gerencia o próprio token no app.

### 3. Subir os Containers
```bash
docker compose up -d --build
```

Os serviços sobem assim:
- **Frontend / PWA:** `https://<ZT_IP>` (porta 443, publicada só no IP do ZeroTier, com certificados em `./certs`).
- **Backend API e PostgreSQL:** não são publicados fora do Docker. Só o nginx do frontend fala com o backend, pela rede interna.

Ao abrir o app pela primeira vez, crie o primeiro usuário (ele vira administrador). Detalhes de deploy em [docs/deploy-vm.md](docs/deploy-vm.md) e [docs/zerotier-setup.md](docs/zerotier-setup.md).

---

## 📲 Configurando a Automação Android

Para receber as transações de compras e Pix instantaneamente:

1. Baixe a APK mais recente na aba **Releases** do [finapp-listener](https://github.com/nicolasdtb/finapp-listener) e instale no celular.
2. Conceda a permissão de **Acesso às Notificações** e escolha os bancos monitorados.
3. Cole no app o **token do webhook** que aparece no FinApp em Configurações > Conta. A URL padrão já aponta para o servidor (`https://<ZT_IP>/api/v1/webhooks/bank-notification`).
4. Pronto! Cada compra ou transferência recebida cairá imediatamente na aba de pendências do seu FinApp.

O listener se atualiza pelo próprio app: ao abrir, ele consulta as Releases e, havendo versão nova, mostra o banner **Nova versão disponível** com o botão **Baixar e instalar**.

---

## 🔒 Segurança e Privacidade

- **Dados Soberanos:** Toda a base de dados reside no seu próprio disco rígido dentro do volume PostgreSQL.
- **Isolamento de Usuários:** Todas as queries são estritamente filtradas pelo `user_id` extraído da sessão JWT criptografada.
- **Rede Privada:** o frontend é publicado apenas no IP do **ZeroTier** da VM, sem expor portas para a internet aberta. Banco e backend ficam dentro da rede interna do Docker.
- **Cadastro por convite e webhook por usuário:** só entra quem recebeu um convite do administrador, e cada usuário usa o próprio token de webhook.
- **Backups criptografados** fora da VM, com teste de restauração documentado.

---

## 📄 Licença

Este projeto é desenvolvido para uso pessoal e sob licença aberta [MIT](LICENSE). Sinta-se livre para usar, estudar e customizar para a sua vida financeira!

<p align="center">
  Desenvolvido com foco em <b>autonomia, simplicidade e precisão financeira</b>.
</p>
