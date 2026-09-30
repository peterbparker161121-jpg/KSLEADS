// ==============================================================================
// KS LEADS — REAL LEAD ENRICHMENT ENGINE
// Fonte cadastral: Base Empresarial / dados públicos da Receita Federal
//
// IMPORTANTE:
// - Não gera CNPJ.
// - Não gera telefone.
// - Não inventa razão social.
// - Não transforma celular em WhatsApp confirmado.
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

function cleanDigits(value) {
  return String(value || '')
    .replace(/\D/g, '');
}

function formatCNPJ(value) {
  const digits =
    cleanDigits(value);

  if (
    digits.length !== 14
  ) {
    return value || null;
  }

  return (
    `${digits.slice(0, 2)}.` +
    `${digits.slice(2, 5)}.` +
    `${digits.slice(5, 8)}/` +
    `${digits.slice(8, 12)}-` +
    `${digits.slice(12)}`
  );
}

function formatPhoneBR(value) {
  if (!value) return '';

  let digits =
    cleanDigits(value);

  if (
    digits.startsWith('55') &&
    digits.length > 11
  ) {
    digits =
      digits.slice(2);
  }

  if (
    digits.length === 11
  ) {
    return (
      `(${digits.slice(0, 2)}) ` +
      `${digits.slice(2, 7)}-${digits.slice(7)}`
    );
  }

  if (
    digits.length === 10
  ) {
    return (
      `(${digits.slice(0, 2)}) ` +
      `${digits.slice(2, 6)}-${digits.slice(6)}`
    );
  }

  return value;
}

function isMobileBR(value) {
  const digits =
    cleanDigits(value);

  return (
    digits.length === 11 &&
    digits[2] === '9'
  );
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 12000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

// ==============================================================================
// BUSCA POR CNPJ
// ==============================================================================

async function fetchCompanyByCNPJ(
  cnpj
) {
  const cleanCnpj =
    cleanDigits(cnpj);

  if (
    cleanCnpj.length !== 14
  ) {
    return null;
  }

  const url =
    `${BASE_EMPRESARIAL_API}/companies/${cleanCnpj}`;

  const response =
    await fetchWithTimeout(
      url,
      {
        method: 'GET',

        headers: {
          'Accept':
            'application/json',

          'User-Agent':
            USER_AGENT
        }
      },
      15000
    );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `Base Empresarial retornou resposta inválida. HTTP ${response.status}`
    );
  }

  if (
    response.status === 404
  ) {
    return null;
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Base Empresarial HTTP ${response.status}`
    );
  }

  return (
    data?.data ||
    data?.company ||
    data
  );
}

// ==============================================================================
// NORMALIZAÇÃO
// ==============================================================================

function normalizeCompanyData(
  data,
  original
) {
  if (!data) {
    return null;
  }

  const company =
    data.empresa ||
    data.company ||
    data;

  const address =
    data.endereco ||
    company.endereco ||
    data.address ||
    {};

  const contact =
    data.contato ||
    company.contato ||
    data.contact ||
    {};

  const cnpj =
    data.cnpj ||
    company.cnpj ||
    original.cnpj ||
    null;

  const legalName =
    data.razao_social ||
    company.razao_social ||
    data.legal_name ||
    company.legal_name ||
    null;

  const tradeName =
    data.nome_fantasia ||
    company.nome_fantasia ||
    data.trade_name ||
    company.trade_name ||
    legalName ||
    original.business_name ||
    null;

  const rawPhone =
    contact.telefone_formatado ||
    contact.telefone ||
    contact.phone ||
    data.telefone ||
    company.telefone ||
    '';

  let phone = '';

  if (rawPhone) {
    phone =
      formatPhoneBR(
        contact.ddd
          ? `${contact.ddd}${rawPhone}`
          : rawPhone
      );
  }

  const status =
    data.situacao_cadastral ||
    company.situacao_cadastral ||
    data.status ||
    company.status ||
    null;

  const fullAddress =
    address.endereco_completo ||
    [
      address.logradouro,
      address.numero,
      address.complemento,
      address.bairro,
      address.municipio_nome ||
        address.municipio,
      address.uf,
      address.cep
    ]
      .filter(Boolean)
      .join(', ');

  const mobile =
    isMobileBR(phone);

  /*
   * IMPORTANTE:
   *
   * Celular NÃO significa WhatsApp confirmado.
   *
   * Portanto:
   *
   * celular -> nao_confirmado
   *
   * Não existe integração oficial do WhatsApp
   * neste arquivo para confirmar a conta.
   */
  let whatsappStatus =
    'nao_encontrado';

  let whatsappUrl =
    null;

  if (phone) {
    whatsappStatus =
      mobile
        ? 'nao_confirmado'
        : 'nao_confirmado';

    if (mobile) {
      const digits =
        cleanDigits(phone);

      whatsappUrl =
        `https://wa.me/55${digits}`;
    }
  }

  const website =
    data.website ||
    company.website ||
    data.site ||
    company.site ||
    data.website_url ||
    company.website_url ||
    null;

  return {

    cnpj:
      formatCNPJ(cnpj),

    legal_name:
      legalName,

    trade_name:
      tradeName,

    cnpj_status:
      status,

    registered_phone:
      phone || null,

    business_phone:
      original.business_phone ||
      phone ||
      null,

    registered_address:
      fullAddress ||
      null,

    whatsapp_status:
      whatsappStatus,

    whatsapp_url:
      whatsappUrl,

    website_status:
      website
        ? 'site_encontrado'
        : original.website_url
          ? 'site_encontrado'
          : 'site_nao_encontrado',

    website_url:
      website ||
      original.website_url ||
      null,

    cnae:
      data.cnae_fiscal ||
      company.cnae_fiscal ||
      null,

    cnae_description:
      data.cnae_fiscal_descricao ||
      company.cnae_fiscal_descricao ||
      null,

    partners:
      Array.isArray(
        data.socios ||
        company.socios
      )
        ? (
            data.socios ||
            company.socios
          )
            .map(
              item =>
                item.nome ||
                item.nome_socio ||
                null
            )
            .filter(Boolean)
            .slice(0, 10)
        : [],

    source:
      'Base Empresarial / Receita Federal',

    source_verified_at:
      new Date().toISOString(),

    source_policy: {
      cnpj_real:
        Boolean(cnpj),

      phone_real:
        Boolean(phone),

      whatsapp_confirmed:
        false,

      website_verified:
        Boolean(website),

      fake_data:
        false
    }
  };
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

  if (
    req.method !== 'POST'
  ) {
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
          'Sessão inválida. Por favor, acesse novamente.'
      });
    }

    // --------------------------------------------------------------------------
    // DADOS RECEBIDOS
    // --------------------------------------------------------------------------

    const body =
      req.body || {};

    const cnpj =
      body.cnpj ||
      null;

    const businessName =
      body.business_name ||
      null;

    const city =
      body.city ||
      null;

    const state =
      body.state ||
      null;

    const businessPhone =
      body.business_phone ||
      null;

    const websiteUrl =
      body.website_url ||
      null;

    const original = {
      cnpj,
      business_name:
        businessName,
      city,
      state,
      business_phone:
        businessPhone,
      website_url:
        websiteUrl
    };

    // --------------------------------------------------------------------------
    // SEM CNPJ
    // --------------------------------------------------------------------------

    if (
      cleanDigits(cnpj).length !== 14
    ) {

      return res.status(200).json({
        success: true,

        enriched: {
          cnpj: null,

          legal_name:
            null,

          trade_name:
            businessName,

          cnpj_status:
            null,

          registered_phone:
            null,

          business_phone:
            businessPhone,

          registered_address:
            null,

          whatsapp_status:
            businessPhone
              ? (
                  isMobileBR(
                    businessPhone
                  )
                    ? 'nao_confirmado'
                    : 'nao_confirmado'
                )
              : 'nao_encontrado',

          website_status:
            websiteUrl
              ? 'site_encontrado'
              : 'site_nao_encontrado',

          website_url:
            websiteUrl,

          partners:
            [],

          cnae:
            null,

          cnae_description:
            null,

          source:
            'Nenhuma consulta cadastral realizada',

          source_policy: {
            fake_data:
              false,

            cnpj_real:
              false,

            whatsapp_confirmed:
              false
          }
        }
      });
    }

    // --------------------------------------------------------------------------
    // CONSULTA REAL
    // --------------------------------------------------------------------------

    const company =
      await fetchCompanyByCNPJ(
        cnpj
      );

    if (!company) {

      return res.status(200).json({
        success: true,

        enriched: {
          cnpj:
            formatCNPJ(cnpj),

          legal_name:
            null,

          trade_name:
            businessName,

          cnpj_status:
            null,

          registered_phone:
            null,

          business_phone:
            businessPhone,

          registered_address:
            null,

          whatsapp_status:
            businessPhone
              ? 'nao_confirmado'
              : 'nao_encontrado',

          website_status:
            websiteUrl
              ? 'site_encontrado'
              : 'site_nao_encontrado',

          website_url:
            websiteUrl,

          partners:
            [],

          cnae:
            null,

          cnae_description:
            null,

          source:
            'Base Empresarial / Receita Federal',

          source_policy: {
            fake_data:
              false,

            cnpj_real:
              true,

            whatsapp_confirmed:
              false
          }
        }
      });
    }

    // --------------------------------------------------------------------------
    // NORMALIZA
    // --------------------------------------------------------------------------

    const enriched =
      normalizeCompanyData(
        company,
        original
      );

    return res.status(200).json({
      success: true,

      enriched
    });

  } catch (error) {

    console.error(
      '[KS Leads Enrich] Erro:',
      error
    );

    return res.status(502).json({
      success: false,

      error:
        error.message ||
        'Falha ao consultar os dados cadastrais.',

      enriched:
        null
    });
  }
}
