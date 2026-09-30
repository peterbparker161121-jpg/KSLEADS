// ==============================================================================
// KS LEADS — LEAD SEARCH ENGINE (VERCEL SERVERLESS)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Formata telefone para padrão brasileiro (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
function formatPhoneBR(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    const d = digits.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return raw;
}

// Nenhum fallback sintético: o KS Leads nunca fabrica leads.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // 1. Extração do token JWT de autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }
  const token = authHeader.replace('Bearer ', '');

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Configuração do servidor Supabase incompleta.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 2. Validação do usuário através do Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, acesse novamente.' });
    }

    // 3. Obtenção do perfil e verificação de créditos / bloqueio
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role, status, credit_balance, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'Perfil do usuário não encontrado.' });
    }

    if (profile.status === 'suspended' || profile.status === 'blocked') {
      return res.status(403).json({
        error: 'Sua conta está suspensa ou bloqueada. Entre em contato com o suporte via WhatsApp.',
        status: profile.status
      });
    }

    const isAdmin = profile.role === 'admin';

    // 4. Parâmetros da busca
    const {
      category = 'Dentistas',
      city = 'São Paulo',
      state = 'SP',
      no_website = false,
      has_whatsapp = false,
      min_reviews = 0,
      opportunity_filter = false
    } = req.body || {};

    if (!category.trim() || !city.trim()) {
      return res.status(400).json({ error: 'Informe a categoria e a cidade para a pesquisa.' });
    }

    // 5. Cobrança de crédito atômica (Admin tem uso ilimitado)
    if (!isAdmin) {
      if (profile.credit_balance < 1) {
        return res.status(402).json({
          error: 'Saldo de créditos insuficiente para realizar esta busca. Por favor, adquira créditos ou faça upgrade do seu plano.',
          credit_balance: profile.credit_balance
        });
      }

      const { data: creditResult, error: creditRpcErr } = await supabase.rpc('deduct_user_credits', {
        p_user_id: user.id,
        p_amount: 1,
        p_operation: 'lead_search',
        p_description: `Busca de leads: ${category} em ${city} - ${state}`
      });

      if (creditRpcErr || (creditResult && !creditResult.success)) {
        return res.status(402).json({
          error: creditResult?.error || 'Erro ao debitar créditos de busca.',
          credit_balance: profile.credit_balance
        });
      }
    }

    // 6. Execução da busca em fontes públicas (OpenStreetMap Overpass API com fallback inteligente)
    let leads = [];
    try {
      // Mapeamento amigável de categorias para tags OpenStreetMap
      const queryCategory = category.toLowerCase();
      let osmTag = 'amenity';
      if (queryCategory.includes('dentist') || queryCategory.includes('odonto')) osmTag = 'amenity=dentist';
      else if (queryCategory.includes('restaurante') || queryCategory.includes('pizzaria') || queryCategory.includes('bar')) osmTag = 'amenity=restaurant';
      else if (queryCategory.includes('farmacia') || queryCategory.includes('drogaria')) osmTag = 'amenity=pharmacy';
      else if (queryCategory.includes('medico') || queryCategory.includes('clinica')) osmTag = 'amenity=clinic';
      else if (queryCategory.includes('academia') || queryCategory.includes('fitness')) osmTag = 'leisure=fitness_centre';
      else if (queryCategory.includes('advogado') || queryCategory.includes('advocacia')) osmTag = 'office=lawyer';
      else if (queryCategory.includes('oficina') || queryCategory.includes('mecanica')) osmTag = 'shop=car_repair';
      else osmTag = 'shop';

      const overpassQuery = `
        [out:json][timeout:8];
        area["name"="${city}"]->.searchArea;
        (
          node[${osmTag}](area.searchArea);
          way[${osmTag}](area.searchArea);
        );
        out center 25;
      `;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout para resposta rápida

      const osmResp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'KSLeadsProspector/1.0' }
      });
      clearTimeout(timeoutId);

      if (osmResp.ok) {
        const osmData = await osmResp.json();
        if (osmData.elements && osmData.elements.length > 0) {
          leads = osmData.elements
            .filter(el => el.tags && (el.tags.name || el.tags['brand']))
            .slice(0, 15)
            .map((el, idx) => {
              const tags = el.tags || {};
              const name = (tags.name || tags['brand'] || `${category} Local`).toUpperCase();
              const rawPhone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '';
              const rawWebsite = tags.website || tags['contact:website'] || tags['url'] || null;
              const hasSite = Boolean(rawWebsite && rawWebsite.trim().length > 4);
              const formattedPhone = formatPhoneBR(rawPhone);
              const isMobilePhone = formattedPhone.includes(' 9');

              // Cálculo transparente do Índice de Oportunidade
              let oppScore = 15;
              if (!hasSite) oppScore += 35; // Principal alvo: venda de sites!
              if (formattedPhone) oppScore += 15;
              if (isMobilePhone) oppScore += 20; // WhatsApp disponível
              if (tags['opening_hours']) oppScore += 15; // Empresa ativa e movimentada

              return {
                id: `osm_${el.id}`,
                business_name: name,
                trade_name: tags['name'] || name,
                legal_name: tags['operator'] || `${name} LTDA`,
                cnpj: null, // Será enriquecido no botão "Enriquecer" via BrasilAPI
                cnpj_status: null,
                registered_phone: '',
                business_phone: formattedPhone || 'Não informado nas fontes',
                whatsapp_status: formattedPhone ? 'nao_confirmado' : 'nao_encontrado',
                website_status: hasSite ? 'site_encontrado' : 'site_nao_encontrado',
                website_url: hasSite ? rawWebsite : null,
                google_rating: null,
                google_reviews_count: null,
                google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${city} ${state}`)}`,
                category: category,
                address: `${tags['addr:street'] || 'Área Central'}${tags['addr:housenumber'] ? ', ' + tags['addr:housenumber'] : ''}`,
                city: city,
                state: state.toUpperCase(),
                opportunity_score: Math.min(oppScore, 100),
                sources_metadata: {
                  provider: 'OpenStreetMap & Diretórios Públicos',
                  collected_at: new Date().toISOString()
                }
              };
            });
        }
      }
    } catch (apiErr) {
      console.warn('[KS Leads Search] Provedor primário indisponível ou timeout, ativando fallback consolidado.', apiErr.message);
    }

    // Se a busca na API externa não retornou registros suficientes ou falhou, usa a inteligência de leads locais
    if (!leads || leads.length === 0) {
      return res.status(200).json({ success: true, category, city, state: state.toUpperCase(), results_count: 0, credit_balance: isAdmin ? 999999 : profile.credit_balance, is_admin: isAdmin, leads: [], message: 'Nenhuma empresa real foi encontrada nas fontes consultadas.' });
    }

    // 7. Aplicação de filtros avançados solicitados pelo usuário
    if (no_website) {
      leads = leads.filter(l => l.website_status === 'site_nao_encontrado');
    }
    if (has_whatsapp) {
      leads = leads.filter(l => l.whatsapp_status === 'confirmado');
    }
    if (min_reviews > 0) {
      leads = leads.filter(l => l.google_reviews_count >= min_reviews);
    }
    if (opportunity_filter) {
      // Filtro especial "Oportunidade para site": Sem site + telefone com WhatsApp + empresa ativa
      leads = leads.filter(l => l.website_status === 'site_nao_encontrado' && l.whatsapp_status === 'confirmado');
    }

    // Ordena pelo maior Índice de Oportunidade
    leads.sort((a, b) => b.opportunity_score - a.opportunity_score);

    // 8. Grava log da busca no Supabase
    await supabase.from('searches').insert({
      user_id: user.id,
      category,
      city,
      state: state.toUpperCase(),
      filters: { no_website, has_whatsapp, min_reviews, opportunity_filter },
      results_count: leads.length,
      credits_used: isAdmin ? 0 : 1
    });

    // 9. Retorna resultado com o novo saldo de créditos
    const updatedBalance = isAdmin ? 999999 : (profile.credit_balance - 1);

    return res.status(200).json({
      success: true,
      category,
      city,
      state: state.toUpperCase(),
      results_count: leads.length,
      credit_balance: updatedBalance,
      is_admin: isAdmin,
      leads: leads
    });

  } catch (err) {
    console.error('[KS Leads Search] Erro inesperado:', err);
    return res.status(500).json({ error: 'Não foi possível concluir esta consulta. Tente novamente em alguns instantes.' });
  }
}
