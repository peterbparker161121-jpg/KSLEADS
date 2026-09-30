-- ==============================================================================
-- KS LEADS — DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- ==============================================================================

-- Habilita extensão pgcrypto / uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'customer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'trial', 'suspended', 'blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'pending', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly', 'one_time');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('novo', 'contatado', 'respondeu', 'interessado', 'proposta_enviada', 'cliente', 'sem_interesse');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE whatsapp_status AS ENUM ('confirmado', 'nao_confirmado', 'nao_encontrado', 'verificacao_indisponivel');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE website_status AS ENUM ('site_encontrado', 'site_nao_encontrado', 'site_nao_verificado', 'site_inacessivel');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE credit_operation AS ENUM ('subscription_credit', 'manual_adjustment', 'purchase', 'lead_search', 'lead_enrichment', 'refund');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE PLANOS (PLANS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    credits_included INTEGER NOT NULL DEFAULT 50,
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    cakto_offer_id TEXT,
    cakto_checkout_url TEXT,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PERFIS DE USUÁRIO (PROFILES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    status account_status NOT NULL DEFAULT 'active',
    credit_balance INTEGER NOT NULL DEFAULT 10,
    current_plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    subscription_status subscription_status NOT NULL DEFAULT 'trial',
    subscription_end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TABELA DE ASSINATURAS (SUBSCRIPTIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'pending',
    cakto_subscription_id TEXT,
    cakto_order_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABELA DE TRANSAÇÕES DE CRÉDITOS (CREDIT_TRANSACTIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    operation_type credit_operation NOT NULL,
    description TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABELA DE LEADS (LEADS SALVOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    trade_name TEXT,
    legal_name TEXT,
    cnpj TEXT,
    cnpj_status TEXT,
    registered_phone TEXT, -- Telefone cadastral (Receita/CNPJ)
    business_phone TEXT,   -- Telefone da empresa (Google/Listings/Site)
    whatsapp_status whatsapp_status NOT NULL DEFAULT 'verificacao_indisponivel',
    whatsapp_validated_at TIMESTAMPTZ,
    website_status website_status NOT NULL DEFAULT 'site_nao_verificado',
    website_url TEXT,
    google_rating NUMERIC(2,1),
    google_reviews_count INTEGER DEFAULT 0,
    google_maps_url TEXT,
    category TEXT,
    address TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    opportunity_score INTEGER DEFAULT 0,
    prospecting_status lead_status NOT NULL DEFAULT 'novo',
    sources_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice de unicidade de lead por usuário para prevenir duplicidades
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_user_cnpj ON public.leads(user_id, cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON public.leads(user_id, prospecting_status);
CREATE INDEX IF NOT EXISTS idx_leads_user_city ON public.leads(user_id, city, state);

-- ------------------------------------------------------------------------------
-- 6. ANOTAÇÕES DE LEADS (LEAD_NOTES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. HISTÓRICO DE ATIVIDADE DO LEAD (LEAD_ACTIVITY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. HISTÓRICO DE BUSCAS (SEARCHES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT,
    city TEXT,
    state TEXT,
    filters JSONB DEFAULT '{}'::jsonb,
    results_count INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. EVENTOS DE PAGAMENTO CAKTO (PAYMENT_EVENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status payment_status NOT NULL DEFAULT 'pending',
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. CONSENTIMENTO DE COOKIES (COOKIE_CONSENTS - LGPD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cookie_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    visitor_id TEXT NOT NULL,
    necessary BOOLEAN NOT NULL DEFAULT true,
    analytics BOOLEAN NOT NULL DEFAULT false,
    marketing BOOLEAN NOT NULL DEFAULT false,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. SOLICITAÇÕES DE TITULARES LGPD (DATA_REQUESTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL, -- 'export' ou 'delete'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rejected'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 12. LOGS DE AUDITORIA (AUDIT_LOGS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. CONFIGURAÇÕES GERAIS DO SISTEMA (SYSTEM_SETTINGS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
