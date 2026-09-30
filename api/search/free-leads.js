/**
 * KS LEADS
 * Motor de descoberta gratuita de empresas
 *
 * Não usa:
 * - API paga
 * - Service Role
 * - Nominatim
 * - Google API
 *
 * Usa somente dados públicos do OpenStreetMap
 * através de servidores Overpass.
 */

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

const CATEGORY_TAGS = {
  dentist: ['amenity=dentist'],
  dentista: ['amenity=dentist'],
  dentistas: ['amenity=dentist'],
  odonto: ['amenity=dentist'],
  odontologia: ['amenity=dentist'],

  restaurant: ['amenity=restaurant'],
  restaurante: ['amenity=restaurant'],
  restaurantes: ['amenity=restaurant'],
  pizzaria: ['amenity=restaurant'],

  bar: ['amenity=bar'],
  bares: ['amenity=bar'],
  pub: ['amenity=pub'],

  farmacia: ['amenity=pharmacy'],
  farmácia: ['amenity=pharmacy'],
  farmacias: ['amenity=pharmacy'],
  drogaria: ['amenity=pharmacy'],

  clinica: ['amenity=clinic'],
  clínica: ['amenity=clinic'],
  clinicas: ['amenity=clinic'],
  clínicas: ['amenity=clinic'],

  medico: ['amenity=doctors'],
  médico: ['amenity=doctors'],
  medicos: ['amenity=doctors'],
  médicos: ['amenity=doctors'],

  academia: ['leisure=fitness_centre'],
  academias: ['leisure=fitness_centre'],
  fitness: ['leisure=fitness_centre'],

  advogado: ['office=lawyer'],
  advogada: ['office=lawyer'],
  advogados: ['office=lawyer'],
  advocacia: ['office=lawyer'],

  contabilidade: ['office=accountant'],
  contador: ['office=accountant'],
  contadores: ['office=accountant'],

  imobiliaria: ['office=estate_agent'],
  imobiliária: ['office=estate_agent'],
  imobiliarias: ['office=estate_agent'],
  imobiliárias: ['office=estate_agent'],

  oficina: ['shop=car_repair'],
  oficinas: ['shop=car_repair'],
  mecanica: ['shop=car_repair'],
  mecânica: ['shop=car_repair'],

  cabeleireiro: ['shop=hairdresser'],
  cabeleireira: ['shop=hairdresser'],
  cabeleireiros: ['shop=hairdresser'],

  barbearia: ['shop=hairdresser'],
  barbearias: ['shop=hairdresser'],

  salao: ['shop=hairdresser'],
  salão: ['shop=hairdresser'],
  saloes: ['shop=hairdresser'],
  salões: ['shop=hairdresser'],

  estetica: ['shop=beauty'],
  estética: ['shop=beauty'],
  esteticas: ['shop=beauty'],
  estéticas: ['shop=beauty'],

  hotel: ['tourism=hotel'],
  hoteis: ['tourism=hotel'],
  hotéis: ['tourism=hotel'],

  pousada: ['tourism=guest_house'],
  pousadas: ['tourism=guest_house'],

  mercado: ['shop=supermarket'],
  mercados: ['shop=supermarket'],
  supermercado: ['shop=supermarket'],
  supermercados: ['shop=supermarket'],

  padaria: ['shop=bakery'],
  padarias: ['shop=bakery'],

  petshop: ['shop=pet'],
  pet: ['shop=pet'],
  pets: ['shop=pet'],

  floricultura: ['shop=florist'],
  floriculturas: ['shop=florist'],

  escola: ['amenity=school'],
  escolas: ['amenity=school'],

  colegio: ['amenity=school'],
  colégio: ['amenity=school'],

  creche: ['amenity=kindergarten'],
  creches: ['amenity=kindergarten'],

  construtora: ['office=company'],
  construtoras: ['office=company'],

  arquiteto: ['office=architect'],
  arquiteta: ['office=architect'],
  arquitetos: ['office=architect'],
  arquitetura: ['office=architect'],

  fotografo: ['shop=photo'],
  fotógrafo: ['shop=photo'],
  fotografos: ['shop=photo'],
  fotógrafos: ['shop=photo'],

  joalheria: ['shop=jewelry'],
  joalheria: ['shop=jewelry'],

  loja: ['shop=*'],
  lojas: ['shop=*']
};

const STATE_CODES = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins'
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeOverpass(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function getStateCode(value) {
  const text = String(value || '').toUpperCase();

  const match = text.match(/\b[A-Z]{2}\b/);

  if (match && STATE_CODES[match[0]]) {
    return match[0];
  }

  const normalized = normalize(value);

  for (const [code, name] of Object.entries(STATE_CODES)) {
    if (normalize(name) === normalized) {
      return code;
    }
  }

  return null;
}

function getCategoryTags(category) {
  const normalized = normalize(category);

  for (const [keyword, tags] of Object.entries(CATEGORY_TAGS)) {
    if (normalized.includes(normalize(keyword))) {
      return tags;
    }
  }

  return null;
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 7500
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cria consulta Overpass.
 *
 * Em vez de:
 *
 * cidade -> Nominatim -> coordenadas -> raio de 15km
 *
 * fazemos:
 *
 * estado -> área administrativa
 * cidade -> área administrativa
 * empresa -> dentro da cidade
 *
 * Isso reduz bastante o custo da consulta.
 */
function buildQuery(city, stateCode, tags) {
  const cityEscaped = escapeOverpass(city);

  const tagQueries = [];

  for (const tag of tags) {
    const separator = tag.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = tag.substring(0, separator);
    const value = tag.substring(separator + 1);

    if (value === '*') {
      tagQueries.push(
        `nwr["${escapeOverpass(key)}"](area.city)(area.state);`
      );
    } else {
      tagQueries.push(
        `nwr["${escapeOverpass(key)}"="${escapeOverpass(value)}"](area.city)(area.state);`
      );
    }
  }

  if (!tagQueries.length) {
    throw new Error(
      'Nenhum filtro válido foi encontrado para esta categoria.'
    );
  }

  return `
[out:json][timeout:8];

area["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"="BR-${stateCode}"]->.state;

area["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"="${cityEscaped}"]->.city;

(
  ${tagQueries.join('\n  ')}
);

out center tags;
`;
}

/**
 * Consulta um servidor Overpass.
 */
async function requestEndpoint(endpoint, query) {
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',

        'Accept': 'application/json',

        'User-Agent':
          'KS-Leads/1.0 (+https://ksleads.vercel.app)'
      },
      body: `data=${encodeURIComponent(query)}`
    },
    7500
  );

  if (!response.ok) {
    throw new Error(
      `${endpoint} respondeu HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.elements)) {
    throw new Error(
      `${endpoint} retornou uma resposta inválida.`
    );
  }

  return data.elements;
}

/**
 * Consulta os servidores em paralelo.
 *
 * O primeiro que responder corretamente ganha.
 */
async function searchOverpass(query) {
  const requests = OVERPASS_ENDPOINTS.map(
    async endpoint => {
      const elements = await requestEndpoint(
        endpoint,
        query
      );

      return {
        endpoint,
        elements
      };
    }
  );

  try {
    return await Promise.any(requests);
  } catch (error) {
    const errors = Array.isArray(error?.errors)
      ? error.errors
          .map(item =>
            item?.message || String(item)
          )
          .join(' | ')
      : 'Todos os servidores Overpass falharam.';

    throw new Error(errors);
  }
}

function cleanElements(elements) {
  const unique = new Map();

  for (const element of elements) {
    if (!element || !element.id) {
      continue;
    }

    const tags = element.tags || {};

    const name =
      tags.name ||
      tags.brand ||
      tags.operator;

    if (!name) {
      continue;
    }

    const normalizedName = normalize(name);

    if (!unique.has(normalizedName)) {
      unique.set(normalizedName, element);
    }
  }

  return Array.from(unique.values())
    .slice(0, 100);
}

module.exports = async function handler(req, res) {

  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.'
    });
  }

  const startedAt = Date.now();

  try {

    const body = req.body || {};

    const category = String(
      body.category || ''
    ).trim();

    const city = String(
      body.city || ''
    ).trim();

    const state = String(
      body.state || ''
    ).trim();

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Informe a categoria.'
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Informe a cidade.'
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'Informe o estado.'
      });
    }

    const stateCode = getStateCode(state);

    if (!stateCode) {
      return res.status(400).json({
        success: false,
        error:
          'Estado inválido. Selecione um estado brasileiro válido.'
      });
    }

    const tags = getCategoryTags(category);

    if (!tags) {
      return res.status(400).json({
        success: false,
        error:
          `A categoria "${category}" ainda não possui uma categoria OSM configurada.`
      });
    }

    const query = buildQuery(
      city,
      stateCode,
      tags
    );

    const result = await searchOverpass(
      query
    );

    const elements = cleanElements(
      result.elements
    );

    console.log(
      `[KS Leads] Busca concluída: ${category} / ${city}-${stateCode} / ${elements.length} resultados / ${Date.now() - startedAt}ms / ${result.endpoint}`
    );

    return res.status(200).json({
      success: true,

      source: {
        provider: 'OpenStreetMap',
        engine: 'Overpass',
        endpoint: result.endpoint
      },

      query: {
        category,
        city,
        state: stateCode
      },

      count: elements.length,

      elements
    });

  } catch (error) {

    console.error(
      '[KS Leads] ERRO REAL NA BUSCA:',
      error
    );

    return res.status(502).json({
      success: false,

      error:
        'Não foi possível consultar as fontes gratuitas agora.',

      message:
        error?.message ||
        'Erro desconhecido na fonte de dados.'
    });
  }
};
