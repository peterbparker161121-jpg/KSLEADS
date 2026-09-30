-- ==============================================================================
-- KS LEADS — ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- FUNÇÃO AUXILIAR: VERIFICA SE É ADMIN
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- ------------------------------------------------------------------------------
-- 1. POLÍTICAS PARA PROFILES
-- ------------------------------------------------------------------------------
-- Usuário lê seu próprio perfil ou Admin lê todos
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Usuário atualiza seus dados básicos (nome, telefone). Saldo e papel são protegidos
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Inserção permitida via trigger ou auth
CREATE POLICY "profiles_insert_own_or_admin" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. POLÍTICAS PARA PLANS
-- ------------------------------------------------------------------------------
-- Qualquer um (mesmo não autenticado) pode ver planos ativos para a Landing Page
CREATE POLICY "plans_select_public" ON public.plans
    FOR SELECT USING (is_active = true OR public.is_admin());

-- Apenas admins podem gerenciar planos
CREATE POLICY "plans_insert_admin" ON public.plans
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "plans_update_admin" ON public.plans
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "plans_delete_admin" ON public.plans
    FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS PARA SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
CREATE POLICY "subscriptions_select_own_or_admin" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS PARA CREDIT_TRANSACTIONS
-- ------------------------------------------------------------------------------
CREATE POLICY "credit_transactions_select_own_or_admin" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "credit_transactions_insert_admin" ON public.credit_transactions
    FOR INSERT WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS PARA LEADS
-- ------------------------------------------------------------------------------
CREATE POLICY "leads_select_own_or_admin" ON public.leads
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "leads_insert_own" ON public.leads
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "leads_update_own" ON public.leads
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "leads_delete_own" ON public.leads
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS PARA LEAD_NOTES E LEAD_ACTIVITY
-- ------------------------------------------------------------------------------
CREATE POLICY "lead_notes_all_own" ON public.lead_notes
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "lead_activity_all_own" ON public.lead_activity
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS PARA SEARCHES
-- ------------------------------------------------------------------------------
CREATE POLICY "searches_all_own" ON public.searches
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS PARA PAYMENT_EVENTS
-- ------------------------------------------------------------------------------
CREATE POLICY "payment_events_admin_only" ON public.payment_events
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS PARA COOKIE_CONSENTS
-- ------------------------------------------------------------------------------
CREATE POLICY "cookie_consents_insert_public" ON public.cookie_consents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "cookie_consents_select_admin" ON public.cookie_consents
    FOR SELECT USING (public.is_admin() OR auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 10. POLÍTICAS PARA DATA_REQUESTS (LGPD)
-- ------------------------------------------------------------------------------
CREATE POLICY "data_requests_all_own" ON public.data_requests
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 11. POLÍTICAS PARA AUDIT_LOGS
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
    FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 12. POLÍTICAS PARA SYSTEM_SETTINGS
-- ------------------------------------------------------------------------------
CREATE POLICY "system_settings_select_all" ON public.system_settings
    FOR SELECT USING (true);

CREATE POLICY "system_settings_admin_all" ON public.system_settings
    FOR ALL USING (public.is_admin());
