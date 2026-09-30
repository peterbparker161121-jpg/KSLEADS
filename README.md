# KS LEADS — Plataforma SaaS de Prospecção Comercial B2B

> **"Encontre empresas. Encontre oportunidades. Venda mais."**

Plataforma profissional de inteligência comercial e descoberta de leads, com foco na identificação de empresas ativas sem site para oferta de desenvolvimento web e serviços digitais.

---

## 🚀 Tecnologias

- **Frontend:** HTML5, CSS3 (Design System Dark Premium), JavaScript Vanilla modular (ES Modules).
- **Backend / Database:** [Supabase](https://supabase.com) (PostgreSQL, Autenticação, Row Level Security e Triggers).
- **Hospedagem & Serverless:** [Vercel](https://vercel.com) (Rotas `/api/*`).
- **Gateway de Pagamento:** [Cakto](https://cakto.com.br) (Checkout transparente e Webhooks idempotentes).
- **Suporte Centralizado:** WhatsApp `+55 19 97801-3794`.
- **Conformidade:** LGPD (Lei nº 13.709/2018).

---

## 📂 Estrutura do Projeto

```text
├── api/                        # Serverless Functions (Vercel)
│   ├── webhook/cakto.js        # Processamento seguro e idempotente de pagamentos
│   ├── search/leads.js         # Motor de busca de oportunidades e cálculo do score
│   ├── enrich/lead.js          # Enriquecimento cadastral CNPJ e distinção de telefones
│   └── admin/users.js          # Operações administrativas (créditos, planos, suspensão)
├── app/                        # Portal do Cliente (Aplicação)
│   ├── index.html              # Dashboard com métricas e leads recentes
│   ├── buscar.html             # Motor de busca com filtro "Oportunidade para Site"
│   ├── leads.html              # CRM de prospecção (Kanban e Tabela) com exportação CSV
│   ├── creditos.html           # Extrato de transações e recargas
│   ├── planos.html             # Upgrade de plano e status de assinatura
│   ├── configuracoes.html      # Perfil e direitos do titular (LGPD)
│   └── bloqueado.html          # Tela de assinatura pendente com regularização
├── admin/                      # Portal Administrativo Restrito
│   ├── index.html              # Visão geral de métricas do sistema
│   ├── usuarios.html           # Gestão de clientes e adição/remoção de créditos
│   ├── planos.html             # Configuração dinâmica de planos e links Cakto
│   ├── pagamentos.html         # Auditoria de eventos de webhook
│   ├── logs.html               # Trilha de auditoria e solicitações LGPD
│   └── configuracoes.html      # Parâmetros gerais (custos de créditos, WhatsApp)
├── assets/
│   ├── css/style.css           # Design system completo dark premium
│   └── js/
│       ├── config.js           # Configurações centralizadas
│       ├── utils.js            # Formatadores pt-BR (Moeda, Data, Telefones, CNPJ)
│       ├── supabase-client.js  # Gerenciador de autenticação e rotas
│       └── cookie-consent.js   # Banner e gestão de cookies LGPD
├── supabase/                   # Migrações e Scripts SQL
│   ├── schema.sql              # Estrutura de tabelas e tipos ENUM
│   ├── rls.sql                 # Políticas Row Level Security multi-tenant
│   ├── triggers.sql            # Criação automática de perfil e dedução atômica
│   └── seed.sql                # Planos padrão e configurações
├── vercel.json                 # Roteamento e cabeçalhos de segurança
├── package.json                # Dependências do backend
└── .env.example                # Modelo de variáveis de ambiente
```

---

## 🛠️ Guia de Instalação e Deploy

### 1. Configurar o Supabase
1. Crie um projeto no [Supabase](https://supabase.com).
2. No painel do Supabase, abra o **SQL Editor** e execute os arquivos na seguinte ordem:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - `supabase/triggers.sql`
   - `supabase/seed.sql`
3. Copie as chaves em **Project Settings > API**:
   - `Project URL`
   - `anon public key`
   - `service_role secret key`

### 2. Configurar a Vercel
1. Conecte o repositório à Vercel.
2. Nas configurações do projeto (**Settings > Environment Variables**), cadastre:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CAKTO_API_TOKEN`
   - `CAKTO_WEBHOOK_SECRET`
3. Execute o deploy.

### 3. Configurar o Webhook na Cakto
1. No painel da Cakto, configure a URL de Webhook:
   ```text
   https://seu-dominio.vercel.app/api/webhook/cakto
   ```
2. Eventos monitorados: `payment.approved`, `order.paid`, `subscription.renewed`, `subscription.canceled`.

---

## 🛡️ Acesso de Administrador (Peter)

- A conta com o e-mail cadastrado como admin ou com a flag `role = 'admin'` no Supabase possui:
  - Créditos ilimitados;
  - Buscas e enriquecimento ilimitados;
  - Acesso ao painel `/admin/`;
  - Capacidade de conceder ou remover créditos manualmente para qualquer usuário.

---

## 📄 Licença e Direitos

Projeto proprietário desenvolvido para **Peter / KS Leads**. Todos os direitos reservados.
