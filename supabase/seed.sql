-- ==============================================================================
-- KS LEADS — SEED DATA (PLANOS INICIAIS E CONFIGURAÇÕES)
-- ==============================================================================

-- Planos Padrão do KS Leads
INSERT INTO public.plans (name, slug, description, price_cents, credits_included, billing_cycle, cakto_offer_id, cakto_checkout_url, features, display_order, is_active)
VALUES 
(
    'Starter',
    'starter',
    'Ideal para autônomos e validação de prospecção rápida.',
    2000,
    50,
    'monthly',
    'cakto_starter_offer',
    'https://cakto.com.br/checkout/ksleads-starter',
    '["50 créditos de busca/mês", "Busca em fontes públicas", "Filtro de oportunidades para sites", "Exportação para CSV", "Suporte via WhatsApp"]'::jsonb,
    1,
    true
),
(
    'Basic',
    'basic',
    'Perfeito para freelancers e pequenas agências de desenvolvimento.',
    4990,
    200,
    'monthly',
    'cakto_basic_offer',
    'https://cakto.com.br/checkout/ksleads-basic',
    '["200 créditos de busca/mês", "Enriquecimento de CNPJ e dados cadastrais", "Distinção de Telefone da Empresa x Cadastral", "CRM integrado de leads", "Exportação ilimitada", "Suporte prioritário"]'::jsonb,
    2,
    true
),
(
    'Pro',
    'pro',
    'O mais recomendado para agências em crescimento ativo e vendas diárias.',
    9990,
    500,
    'monthly',
    'cakto_pro_offer',
    'https://cakto.com.br/checkout/ksleads-pro',
    '["500 créditos de busca/mês", "Enriquecimento avançado e validação WhatsApp", "Índice de Oportunidade inteligente", "Acesso prioritário a novos dados", "Exportação em massa", "Atendimento VIP"]'::jsonb,
    3,
    true
),
(
    'Business',
    'business',
    'Escala máxima para times comerciais e operações de alto volume.',
    19990,
    1500,
    'monthly',
    'cakto_business_offer',
    'https://cakto.com.br/checkout/ksleads-business',
    '["1.500 créditos de busca/mês", "Volume máximo de prospecção comercial", "Todos os recursos do plano Pro inclusos", "Suporte dedicado via WhatsApp", "Prioridade total em consultas"]'::jsonb,
    4,
    true
)
ON CONFLICT (slug) DO UPDATE 
SET price_cents = EXCLUDED.price_cents,
    credits_included = EXCLUDED.credits_included,
    features = EXCLUDED.features;

-- Configurações globais do sistema
INSERT INTO public.system_settings (key, value, description)
VALUES 
('support_whatsapp', '"+55 19 97801-3794"'::jsonb, 'WhatsApp central de atendimento e suporte técnico'),
('app_name', '"KS Leads"'::jsonb, 'Nome oficial da plataforma'),
('currency', '"BRL"'::jsonb, 'Moeda padrão do sistema'),
('locale', '"pt-BR"'::jsonb, 'Localização padrão do sistema'),
('credit_costs', '{"search": 1, "enrichment": 1}'::jsonb, 'Custo de créditos por operação'),
('maintenance_mode', 'false'::jsonb, 'Modo de manutenção ativo ou inativo')
ON CONFLICT (key) DO NOTHING;
