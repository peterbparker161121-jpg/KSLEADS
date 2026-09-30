// ==============================================================================
// KS LEADS — REAL LEAD SEARCH ENGINE
// Fonte cadastral: Base Empresarial / dados públicos da Receita Federal
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_EMPRESARIAL_API =
  'https://baseempresarial.com.br/api/v1';

const USER_AGENT =
  'KS-Leads/1.0 (+https://ksleads.vercel.app)';

// ==============================================================================
// UTILITÁRIOS
// ==============================================================================

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCNPJ(value) {
  const digits = cleanDigits(value);

  if (digits.length !== 14) {
    return value || null;
  }

  return (
    `${digits.slice(0, 2)}.` +
    `${digits.slice(2, 5)}.` +
    `${digits.slice(5, 8)}/` +
    `${digits.slice(8, 12)}-` +
    `${digits.slice(12, 14)}`
  );
}

function formatPhoneBR(value) {
  if (!value) return '';

  let digits = cleanDigits(value);

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return (
      `(${digits.slice(0, 2)}) ` +
      `${digits.slice(2, 7)}-${digits.slice(7)}`
    );
  }

  if (digits.length === 10) {
    return (
      `(${digits.slice(0, 2)}) ` +
      `${digits.slice(2, 6)}-${digits.slice(6)}`
    );
  }

  return value;
}

function isMobileBR(value) {
  const digits = cleanDigits(value);

  if (digits.length !== 11) {
    return false;
  }

  return digits[2] === '9';
}

function escapeQuery(value) {
  return String(value || '').trim();
}

function buildMapsUrl(name, city, state) {
  const query = [
    name,
    city,
    state
  ]
    .filter(Boolean)
    .join(' ');

  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(query)
  );
}

// ==============================================================================
// CNAE
// ==============================================================================
//
// CNAEs principais para categorias comerciais comuns.
// Quando o usuário informar um CNAE diretamente, ele também é aceito.
//
// ==============================================================================

const CATEGORY_CNAE = {

  // Odontologia
  dentista: [
    '8630504'
  ],

  dentistas: [
    '8630504'
  ],

  odonto: [
    '8630504'
  ],

  odontologia: [
    '8630504'
  ],

  odontologico: [
    '8630504'
  ],

  odontologica: [
    '8630504'
  ],

  // Medicina
  medico: [
    '8630501',
    '8630502',
    '8630503'
  ],

  medicos: [
    '8630501',
    '8630502',
    '8630503'
  ],

  clinica: [
    '8630501',
    '8630502',
    '8630503',
    '8630504'
  ],

  clinicas: [
    '8630501',
    '8630502',
    '8630503',
    '8630504'
  ],

  // Psicologia
  psicologo: [
    '8650003'
  ],

  psicologos: [
    '8650003'
  ],

  psicologia: [
    '8650003'
  ],

  // Fisioterapia
  fisioterapia: [
    '8650004'
  ],

  fisioterapeuta: [
    '8650004'
  ],

  fisioterapeutas: [
    '8650004'
  ],

  // Farmácia
  farmacia: [
    '4771701'
  ],

  farmacias: [
    '4771701'
  ],

  drogaria: [
    '4771701'
  ],

  drogarias: [
    '4771701'
  ],

  // Restaurantes
  restaurante: [
    '5611201'
  ],

  restaurantes: [
    '5611201'
  ],

  // Pizzaria não possui CNAE exclusivo.
  // Usamos alimentação preparada para consumo.
  pizzaria: [
    '5611201',
    '5611203'
  ],

  pizza: [
    '5611201',
    '5611203'
  ],

  // Bares
  bar: [
    '5611202'
  ],

  bares: [
    '5611202'
  ],

  // Cabeleireiros / salões
  cabeleireiro: [
    '9602501'
  ],

  cabeleireiros: [
    '9602501'
  ],

  cabeleireira: [
    '9602501'
  ],

  cabeleireiras: [
    '9602501'
  ],

  salao: [
    '9602501'
  ],

  salao_de_beleza: [
    '9602501'
  ],

  // Barbearias
  barbearia: [
    '9602501'
  ],

  barbearias: [
    '9602501'
  ],

  barbeiro: [
    '9602501'
  ],

  // Academias
  academia: [
    '9313100'
  ],

  academias: [
    '9313100'
  ],

  fitness: [
    '9313100'
  ],

  // Advocacia
  advogado: [
    '6911701'
  ],

  advogados: [
    '6911701'
  ],

  advocacia: [
    '6911701'
  ],

  // Contabilidade
  contador: [
    '6920601'
  ],

  contadores: [
    '6920601'
  ],

  contabilidade: [
    '6920601'
  ],

  // Imobiliárias
  imobiliaria: [
    '6821801'
  ],

  imobiliarias: [
    '6821801'
  ],

  // Oficinas
  oficina: [
    '4520001'
  ],

  oficinas: [
    '4520001'
  ],

  mecanica: [
    '4520001'
  ],

  mecanico: [
    '4520001'
  ],

  // Hotéis
  hotel: [
    '5510801'
  ],

  hoteis: [
    '5510801'
  ],

  // Comércio varejista de roupas
  roupas: [
    '4781400'
  ],

  loja_de_roupas: [
    '4781400'
  ],

  vestuario: [
    '4781400'
  ],

  // Mercados
  mercado: [
    '4711301'
  ],

  mercados: [
    '4711301'
  ],

  supermercado: [
    '4711301'
  ],

  supermercados: [
    '4711301'
  ]
};

function resolveCnaes(category) {
  const normalized = normalize(category);

  // Permite o próprio usuário informar um CNAE.
  const onlyDigits = cleanDigits(category);

  if (onlyDigits.length === 7) {
    return [onlyDigits];
  }

  // Busca exata.
  if (CATEGORY_CNAE[normalized]) {
    return CATEGORY_CNAE[normalized];
  }

  // Busca aproximada.
  const entries =
    Object.entries(CATEGORY_CNAE);

  for (const [key, cnaes] of entries) {
    if (
      normalized.includes(key) ||
      key.includes(normalized)
    ) {
      return cnaes;
    }
  }

  return [];
}

// ==============================================================================
// API BASE EMPRESARIAL
// ==============================================================================

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 15000
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCompanies({
  category,
  city,
  state,
  cnae
}) {
  const params =
    new URLSearchParams();

  params.set(
    'uf',
    state.toUpperCase()
  );

  params.set(
    'municipio',
    city
  );

  params.set(
    'situacao',
    '02'
  );

  params.set(
    'per_page',
    '100'
  );

  params.set(
    'page',
    '1'
  );

  /*
   * O CNAE é aplicado quando temos
   * mapeamento confiável.
   */
  if (cnae) {
    params.set(
      'cnae',
      cnae
    );
  }

  const url =
    `${BASE_EMPRESARIAL_API}/companies/search?${params.toString()}`;

  console.log(
    '[KS Leads] Consultando Base Empresarial:',
    url
  );

  const response =
    await fetchWithTimeout(
      url,
      {
        method: 'GET',

        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        }
      },
      18000
    );

  const rawText =
    await response.text();

  let data = null;

  try {
    data =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `Base Empresarial retornou resposta não-JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `HTTP ${response.status}`;

    throw new Error(
      `Base Empresarial: ${message}`
    );
  }

  return data;
}

// ==============================================================================
// NORMALIZAÇÃO
// ==============================================================================

function normalizeCompany(
  company,
  category,
  city,
  state
) {
  if (!company) {
    return null;
  }

  const address =
    company.endereco ||
    company.address ||
    {};

  const contact =
    company.contato ||
    company.contact ||
    {};

  const cnpj =
    company.cnpj ||
    company.documento ||
    null;

  const legalName =
    company.razao_social ||
    company.legal_name ||
    null;

  const tradeName =
    company.nome_fantasia ||
    company.trade_name ||
    legalName ||
    null;

  if (!cnpj && !legalName && !tradeName) {
    return null;
  }

  const rawPhone =
    contact.telefone_formatado ||
    contact.telefone ||
    contact.phone ||
    company.telefone ||
    '';

  const phone =
    rawPhone
      ? formatPhoneBR(
          contact.ddd
            ? `${contact.ddd}${rawPhone}`
            : rawPhone
        )
      : '';

  const cnpjStatus =
    company.situacao_cadastral ||
    company.status ||
    null;

  const active =
    normalize(cnpjStatus) === 'ativa' ||
    company.situacao_cadastral_code === '02';

  const fullAddress =
    address.endereco_completo ||
    [
      address.logradouro,
      address.numero,
      address.complemento,
      address.bairro
    ]
      .filter(Boolean)
      .join(', ');

  const companyCity =
    address.municipio_nome ||
    address.municipio ||
    city;

  const companyState =
    address.uf ||
    state;

  const websiteUrl =
    company.website ||
    company.site ||
    company.website_url ||
    null;

  const mobile =
    isMobileBR(phone);

  let opportunityScore = 0;

  /*
   * Score é apenas uma medida dos
   * critérios encontrados no cadastro.
   * NÃO representa qualidade da empresa
   * nem probabilidade de compra.
   */
  if (!websiteUrl) {
    opportunityScore += 40;
  }

  if (phone) {
    opportunityScore += 20;
  }

  if (mobile) {
    opportunityScore += 15;
  }

  if (active) {
    opportunityScore += 15;
  }

  if (
    company.porte_empresa ||
    company.porte
  ) {
    opportunityScore += 10;
  }

  opportunityScore =
    Math.min(
      opportunityScore,
      100
    );

  return {
    id:
      `cnpj_${cleanDigits(cnpj) || Math.random().toString(36).slice(2)}`,

    business_name:
      String(tradeName || legalName)
        .toUpperCase(),

    trade_name:
      tradeName,

    legal_name:
      legalName,

    cnpj:
      formatCNPJ(cnpj),

    cnpj_status:
      cnpjStatus,

    registered_phone:
      phone || null,

    business_phone:
      phone || null,

    whatsapp_status:
      mobile
        ? 'nao_confirmado'
        : phone
          ? 'nao_confirmado'
          : 'nao_encontrado',

    website_status:
      websiteUrl
        ? 'site_encontrado'
        : 'site_nao_encontrado',

    website_url:
      websiteUrl,

    /*
     * A base cadastral não é fonte
     * de avaliações Google.
     *
     * Portanto NÃO inventamos.
     */
    google_rating:
      null,

    google_reviews_count:
      null,

    google_maps_url:
      buildMapsUrl(
        tradeName || legalName,
        companyCity,
        companyState
      ),

    category:
      category,

    address:
      fullAddress ||
      'Endereço cadastral não informado',

    city:
      companyCity,

    state:
      companyState,

    opportunity_score:
      opportunityScore,

    sources_metadata: {
      provider:
        'Base Empresarial / Receita Federal',

      source_type:
        'cadastro_empresarial',

      verified_date:
        new Date().toISOString(),

      cnpj_verified:
        Boolean(cnpj),

      cnpj_status_verified:
        Boolean(cnpjStatus),

      phone_source:
        phone
          ? 'cadastro_empresarial'
          : null,

      website_checked:
        false,

      google_checked:
        false
    }
  };
}

// ==============================================================================
// DEDUPLICAÇÃO
// ==============================================================================

function deduplicateLeads(leads) {
  const seen =
    new Set();

  const result = [];

  for (const lead of leads) {
    const key =
      cleanDigits(lead.cnpj) ||
      normalize(lead.business_name);

    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(lead);
  }

  return result;
}

// ==============================================================================
// FILTROS
// ==============================================================================

function applyFilters(
  leads,
  {
    no_website,
    has_whatsapp,
    min_reviews,
    opportunity_filter
  }
) {
  return leads.filter(lead => {

    if (
      no_website &&
      lead.website_status !==
        'site_nao_encontrado'
    ) {
      return false;
    }

    if (
      has_whatsapp &&
      lead.whatsapp_status !==
        'confirmado'
    ) {
      return false;
    }

    if (
      Number(min_reviews || 0) > 0
    ) {
      /*
       * Sem Google no cadastro,
       * não podemos afirmar quantidade
       * de avaliações.
       */
      if (
        Number(
          lead.google_reviews_count || 0
        ) <
        Number(min_reviews)
      ) {
        return false;
      }
    }

    if (
      opportunity_filter &&
      Number(lead.opportunity_score || 0) < 50
    ) {
      return false;
    }

    return true;
  });
}

// ==============================================================================
// BUSCA
// ==============================================================================

async function searchCompanies({
  category,
  city,
  state
}) {
  const cnaes =
    resolveCnaes(category);

  let rawCompanies = [];

  /*
   * Quando temos mais de um CNAE,
   * fazemos uma consulta por CNAE.
   */
  if (cnaes.length > 0) {

    for (const cnae of cnaes) {
      try {
        const data =
          await fetchCompanies({
            category,
            city,
            state,
            cnae
          });

        const companies =
          Array.isArray(data)
            ? data
            : data.data ||
              data.companies ||
              data.results ||
              [];

        rawCompanies.push(
          ...companies
        );

      } catch (error) {
        console.warn(
          `[KS Leads] CNAE ${cnae} falhou:`,
          error.message
        );
      }
    }

  } else {

    /*
     * Categoria desconhecida:
     * fazemos busca somente por cidade,
     * sem fingir que encontramos um CNAE
     * específico.
     */
    const data =
      await fetchCompanies({
        category,
        city,
        state,
        cnae: null
      });

    rawCompanies =
      Array.isArray(data)
        ? data
        : data.data ||
          data.companies ||
          data.results ||
          [];
  }

  const normalized =
    rawCompanies
      .map(company =>
        normalizeCompany(
          company,
          category,
          city,
          state
        )
      )
      .filter(Boolean);

  return deduplicateLeads(
    normalized
  );
}

// ==============================================================================
// HANDLER
// ==============================================================================

export default async function handler(
  req,
  res
) {
  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  if (req.method !== 'POST') {
    return res.status(405).json({
      error:
        'Método não permitido. Use POST.'
    });
  }

  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith('Bearer ')
  ) {
    return res.status(401).json({
      error:
        'Acesso não autorizado. Faça login para continuar.'
    });
  }

  const token =
    authHeader.replace(
      'Bearer ',
      ''
    );

  if (
    !supabaseUrl ||
    !supabaseServiceKey
  ) {
    return res.status(500).json({
      error:
        'Configuração do servidor Supabase incompleta.'
    });
  }

  const supabase =
    createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

  try {

    // --------------------------------------------------------------------------
    // AUTENTICAÇÃO
    // --------------------------------------------------------------------------

    const {
      data: {
        user
      },
      error: userError
    } =
      await supabase.auth.getUser(
        token
      );

    if (
      userError ||
      !user
    ) {
      return res.status(401).json({
        error:
          'Sessão expirada ou inválida. Por favor, acesse novamente.'
      });
    }

    // --------------------------------------------------------------------------
    // PERFIL
    // --------------------------------------------------------------------------

    const {
      data: profile,
      error: profileErr
    } =
      await supabase
        .from('profiles')
        .select(
          'id, role, status, credit_balance, subscription_status'
        )
        .eq(
          'id',
          user.id
        )
        .single();

    if (
      profileErr ||
      !profile
    ) {
      return res.status(404).json({
        error:
          'Perfil do usuário não encontrado.'
      });
    }

    if (
      profile.status === 'suspended' ||
      profile.status === 'blocked'
    ) {
      return res.status(403).json({
        error:
          'Sua conta está suspensa ou bloqueada. Entre em contato com o suporte via WhatsApp.',

        status:
          profile.status
      });
    }

    const isAdmin =
      profile.role === 'admin';

    // --------------------------------------------------------------------------
    // PARÂMETROS
    // --------------------------------------------------------------------------

    const body =
      req.body || {};

    const category =
      String(
        body.category ||
        'Dentistas'
      ).trim();

    const city =
      String(
        body.city ||
        'São Paulo'
      ).trim();

    const state =
      String(
        body.state ||
        'SP'
      )
      .split('-')[0]
      .trim()
      .toUpperCase();

    const no_website =
      Boolean(
        body.no_website
      );

    const has_whatsapp =
      Boolean(
        body.has_whatsapp
      );

    const min_reviews =
      Number(
        body.min_reviews || 0
      );

    const opportunity_filter =
      Boolean(
        body.opportunity_filter
      );

    if (
      !category ||
      !city ||
      !state
    ) {
      return res.status(400).json({
        error:
          'Informe categoria, cidade e estado.'
      });
    }

    // --------------------------------------------------------------------------
    // CRÉDITO
    // --------------------------------------------------------------------------

    if (!isAdmin) {

      if (
        Number(
          profile.credit_balance || 0
        ) < 1
      ) {
        return res.status(402).json({
          error:
            'Saldo de créditos insuficiente para realizar esta busca.',
          credit_balance:
            profile.credit_balance
        });
      }

      const {
        data: creditResult,
        error: creditRpcErr
      } =
        await supabase.rpc(
          'deduct_user_credits',
          {
            p_user_id:
              user.id,

            p_amount:
              1,

            p_operation:
              'lead_search',

            p_description:
              `Busca de leads: ${category} em ${city} - ${state}`
          }
        );

      if (
        creditRpcErr ||
        (
          creditResult &&
          creditResult.success === false
        )
      ) {
        return res.status(402).json({
          error:
            creditResult?.error ||
            'Erro ao debitar crédito de busca.',

          credit_balance:
            profile.credit_balance
        });
      }
    }

    // --------------------------------------------------------------------------
    // BUSCA REAL
    // --------------------------------------------------------------------------

    const allLeads =
      await searchCompanies({
        category,
        city,
        state
      });

    if (
      !allLeads.length
    ) {
      return res.status(200).json({
        success: true,

        leads: [],

        count: 0,

        source:
          'Base Empresarial / Receita Federal',

        query: {
          category,
          city,
          state,

          cnaes:
            resolveCnaes(category)
        },

        message:
          'Nenhuma empresa cadastrada foi encontrada para os filtros informados.'
      });
    }

    // --------------------------------------------------------------------------
    // FILTROS
    // --------------------------------------------------------------------------

    const filtered =
      applyFilters(
        allLeads,
        {
          no_website,
          has_whatsapp,
          min_reviews,
          opportunity_filter
        }
      );

    // --------------------------------------------------------------------------
    // ORDENAÇÃO
    // --------------------------------------------------------------------------

    filtered.sort(
      (a, b) =>
        Number(
          b.opportunity_score || 0
        ) -
        Number(
          a.opportunity_score || 0
        )
    );

    const leads =
      filtered.slice(
        0,
        100
      );

    return res.status(200).json({
      success: true,

      leads,

      count:
        leads.length,

      total_found:
        allLeads.length,

      source:
        'Base Empresarial / Receita Federal',

      query: {
        category,
        city,
        state,

        cnaes:
          resolveCnaes(category),

        filters: {
          no_website,
          has_whatsapp,
          min_reviews,
          opportunity_filter
        }
      },

      source_policy: {
        fake_data: false,
        google_reviews_verified: false,
        whatsapp_inferred: false
      }
    });

  } catch (error) {

    console.error(
      '[KS Leads] Erro na busca real:',
      error
    );

    return res.status(502).json({
      success: false,

      error:
        error.message ||
        'Não foi possível consultar a base empresarial.',

      leads: []
    });
  }
}
