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

```env
POSTGRES_USER=finapp_user
POSTGRES_PASSWORD=sua_senha_super_segura
POSTGRES_DB=finapp
PORT=3001
JWT_SECRET=seu_jwt_secret_aleatorio
NODE_ENV=production
```

### 3. Subir os Containers
```bash
docker compose up -d --build
```

Os seguintes serviços estarão ativos:
- **Frontend / PWA:** `http://localhost` (ou `https://localhost` com certificados configurados)
- **Backend API:** `http://localhost:3001`
- **PostgreSQL:** `localhost:5432`

---

## 📲 Configurando a Automação Android

Para receber as transações de compras e Pix instantaneamente:

1. Clone e compile o [finapp-listener](https://github.com/nicolasdtb/finapp-listener) no Android Studio.
2. Instale o APK no seu celular e conceda a permissão de **Acesso às Notificações**.
3. No app listener, aponte a URL do webhook para:
   ```
   http://<IP_DA_SUA_VM>:3001/api/v1/webhooks/bank-notification
   ```
4. Pronto! Cada compra ou transferência recebida cairá imediatamente na aba de pendências do seu FinApp.

---

## 🔒 Segurança e Privacidade

- **Dados Soberanos:** Toda a base de dados reside no seu próprio disco rígido dentro do volume PostgreSQL.
- **Isolamento de Usuários:** Todas as queries são estritamente filtradas pelo `user_id` extraído da sessão JWT criptografada.
- **Rede Privada:** Recomendado rodar sob uma malha de rede segura como **ZeroTier** ou **Tailscale**, eliminando a necessidade de expor portas para a internet aberta.

---

## 📄 Licença

Este projeto é desenvolvido para uso pessoal e sob licença aberta [MIT](LICENSE). Sinta-se livre para usar, estudar e customizar para a sua vida financeira!

<p align="center">
  Desenvolvido com foco em <b>autonomia, simplicidade e precisão financeira</b>.
</p>
