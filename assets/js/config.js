// ==============================================================================
// KS LEADS — CONFIGURAÇÃO CENTRALIZADA (FRONTEND)
// ==============================================================================

export const CONFIG = {
  APP_NAME: 'KS Leads',
  APP_TAGLINE: 'Encontre empresas. Encontre oportunidades. Venda mais.',
  SUPPORT_WHATSAPP: '+55 19 97801-3794',
  SUPPORT_WHATSAPP_RAW: '5519978013794',
  CURRENCY: 'BRL',
  LOCALE: 'pt-BR',
  
  // Chaves do Supabase públicas (Client-side)
  // Devem ser configuradas com os valores do seu projeto Supabase
  SUPABASE_URL: window.__ENV__?.SUPABASE_URL || 'https://ydgsamlmrjzsbxerxrho.supabase.co',
  SUPABASE_ANON_KEY: window.__ENV__?.SUPABASE_ANON_KEY || 'sb_publishable_UYGa2kyC_KlfThKGUzwEyA_GrZThODs',

  // Preços e Planos padrão (Fallback visual quando offline ou antes de carregar do DB)
  DEFAULT_PLANS: [
    {
      id: 'starter',
      name: 'Starter',
      price: 20.00,
      priceFormatted: 'R$ 20,00',
      credits: 50,
      billingCycle: 'mês',
      features: [
        '50 créditos de busca/mês',
        'Busca em fontes públicas e mapas',
        'Filtro de oportunidade para sites',
        'Exportação de leads em CSV',
        'Suporte via WhatsApp'
      ],
      checkoutUrl: 'https://cakto.com.br/checkout/ksleads-starter'
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 49.90,
      priceFormatted: 'R$ 49,90',
      credits: 200,
      billingCycle: 'mês',
      features: [
        '200 créditos de busca/mês',
        'Enriquecimento de dados cadastrais (CNPJ)',
        'Distinção Telefone Empresa x Cadastral',
        'CRM de prospecção e notas',
        'Exportação completa em CSV',
        'Suporte prioritário'
      ],
      checkoutUrl: 'https://cakto.com.br/checkout/ksleads-basic'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 99.90,
      priceFormatted: 'R$ 99,90',
      credits: 500,
      billingCycle: 'mês',
      badge: 'Mais Popular',
      features: [
        '500 créditos de busca/mês',
        'Enriquecimento cadastral prioritário',
        'Validação de WhatsApp de contato',
        'Índice de Oportunidade inteligente',
        'Exportação em massa sem limites',
        'Atendimento VIP via WhatsApp'
      ],
      checkoutUrl: 'https://cakto.com.br/checkout/ksleads-pro'
    },
    {
      id: 'business',
      name: 'Business',
      price: 199.90,
      priceFormatted: 'R$ 199,90',
      credits: 1500,
      billingCycle: 'mês',
      features: [
        '1.500 créditos de busca/mês',
        'Volume máximo para times comerciais',
        'Todos os recursos do plano Pro',
        'Suporte dedicado com Peter',
        'Prioridade máxima no enriquecimento'
      ],
      checkoutUrl: 'https://cakto.com.br/checkout/ksleads-business'
    }
  ],

  // Links Úteis
  getWhatsAppSupportUrl(message = 'Olá! Preciso de ajuda com o KS Leads.') {
    return `https://wa.me/${this.SUPPORT_WHATSAPP_RAW}?text=${encodeURIComponent(message)}`;
  }
};
