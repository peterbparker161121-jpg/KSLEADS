/**
 * KS Leads — Motor de busca gratuita
 * Backend server-side para evitar CORS.
 *
 * Fontes:
 * - Nominatim / OpenStreetMap
 * - Overpass API
 *
 * Não utiliza API paga.
 * Não gera dados fictícios.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

const NOMINATIM_ENDPOINTS = [
  'https://nominatim.openstreetmap.org/search'
];

const CATEGORY_TAGS = {
  dentist: ['amenity=dentist'],
  dentista: ['amenity=dentist'],
  odontologia: ['amenity=dentist'],

  restaurant: ['amenity=restaurant'],
  restaurante: ['amenity=restaurant'],

  pizzaria: ['amenity=restaurant'],
  pizza: ['amenity=restaurant'],

  bar: ['amenity=bar'],
  pub: ['amenity=pub'],

  farmacia: ['amenity=pharmacy'],
  farmácia: ['amenity=pharmacy'],
  drogaria: ['amenity=pharmacy'],

  clinica: ['amenity=clinic', 'amenity=doctors'],
  clínica: ['amenity=clinic', 'amenity=doctors'],

  medico: ['amenity=doctors'],
  médico: ['amenity=doctors'],
  médicos: ['amenity=doctors'],

  academia: ['leisure=fitness_centre'],
  fitness: ['leisure=fitness_centre'],

  advogado: ['office=lawyer'],
  advogada: ['office=lawyer'],
  advocacia: ['office=lawyer'],

  oficina: ['shop=car_repair'],
  mecanica: ['shop=car_repair'],
  mecânica: ['shop=car_repair'],

  cabeleireiro: ['shop=hairdresser'],
  cabeleireira: ['shop=hairdresser'],

  barbearia: ['shop=hairdresser'],

  hotel: ['tourism=hotel'],
  pousada: ['tourism=guest_house'],

  mercado: ['shop=supermarket'],
  supermercado: ['shop=supermarket'],

  padaria: ['shop=bakery'],

  petshop: ['shop=pet'],
  pet: ['shop=pet'],

  floricultura: ['shop=florist'],

  loja: ['shop=*'],

  imobiliaria: ['office=estate_agent'],
  imobiliária: ['office=estate_agent'],

  contabilidade: ['office=accountant'],
  contador: ['office=accountant'],
  contabilidade: ['office=accountant'],

  construtora: ['office=company'],
  arquitetura: ['office=architect'],
  arquiteto: ['office=architect'],

  escola: ['amenity=school'],
  colegio: ['amenity=school'],
  colégio: ['amenity=school'],

  creche: ['amenity=kindergarten'],

  igreja: ['amenity=place_of_worship'],

  salão: ['shop=hairdresser'],
  salao: ['shop=hairdresser'],

  estética: ['shop=beauty'],
  estetica: ['shop=beauty'],

  beleza: ['shop=beauty']
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

function getCategoryTags(category) {
  const normalized = normalize(category);

  for (const [keyword, tags] of Object.entries(CATEGORY_TAGS)) {
    if (normalized.includes(normalize(keyword))) {
      return tags;
    }
  }

  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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
 * Geocodifica cidade/estado usando Nominatim.
 */
async function geocode(city, state) {
  const query = `${city}, ${state}, Brasil`;

  let lastError = null;

  for (const endpoint of NOMINATIM_ENDPOINTS) {
    try {
      const url =
        `${endpoint}?format=jsonv2` +
        `&limit=1` +
        `&countrycodes=br` +
        `&q=${encodeURIComponent(query)}`;

      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'KS-Leads/1.0'
          }
        },
        7000
      );

      if (!response.ok) {
        lastError = new Error(
          `Nominatim HTTP ${response.status}`
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data) || !data.length) {
        lastError = new Error(
          `Cidade não encontrada: ${city}/${state}`
        );
        continue;
      }

      const result = data[0];

      const lat = Number(result.lat);
      const lon = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        lastError = new Error(
          'Coordenadas inválidas retornadas pelo geocodificador.'
        );
        continue;
      }

      return {
        lat,
        lon,
        display_name: result.display_name || query
      };

    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    'Não foi possível localizar a cidade.'
  );
}

/**
 * Cria uma consulta Overpass.
 */
function buildOverpassQuery(lat, lon, tags) {
  /*
   * 12 km de raio para reduzir tempo de processamento.
   * O resultado é limitado a 100 elementos.
   */

  const radius = 12000;

  const clauses = [];

  for (const tag of tags) {

    if (tag.endsWith('=*')) {
      const key = tag.slice(0, -2);

      clauses.push(
        `nwr["${escapeOverpass(key)}"](around:${radius},${lat},${lon});`
      );

      continue;
    }

    const separator = tag.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = tag.slice(0, separator);
    const value = tag.slice(separator + 1);

    clauses.push(
      `nwr["${escapeOverpass(key)}"="${escapeOverpass(value)}"](around:${radius},${lat},${lon});`
    );
  }

  if (!clauses.length) {
    throw new Error(
      'Categoria não possui uma fonte gratuita configurada.'
    );
  }

  return `
[out:json][timeout:15];
(
${clauses.join('\n')}
);
out center tags 100;
`;
}

/**
 * Consulta um servidor Overpass.
 */
async function requestOverpass(endpoint, query) {

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': 'KS-Leads/1.0'
      },
      body: `data=${encodeURIComponent(query)}`
    },
    8000
  );

  if (!response.ok) {
    throw new Error(
      `Overpass HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.elements)) {
    throw new Error(
      'Resposta inválida do Overpass.'
    );
  }

  return data.elements;
}

/**
 * Consulta múltiplos servidores em paralelo.
 *
 * Assim, se um servidor estiver lento ou fora do ar,
 * outro pode responder.
 */
async function searchOverpass(lat, lon, tags) {

  const query = buildOverpassQuery(lat, lon, tags);

  const requests = OVERPASS_ENDPOINTS.map(async (endpoint) => {

    try {

      const elements = await requestOverpass(
        endpoint,
        query
      );

      if (!elements.length) {
        throw new Error(
          'Servidor respondeu sem resultados.'
        );
      }

      return {
        endpoint,
        elements
      };

    } catch (error) {

      throw {
        endpoint,
        error: error?.message || 'Erro desconhecido'
      };
    }
  });

  try {

    const result = await Promise.any(requests);

    return result;

  } catch (error) {

    const details = Array.isArray(error?.errors)
      ? error.errors
          .map(item => `${item.endpoint}: ${item.error}`)
          .join(' | ')
      : 'Nenhum servidor Overpass respondeu.';

    throw new Error(details);
  }
}

/**
 * Handler Vercel.
 */
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

    const tags = getCategoryTags(category);

    if (!tags) {

      return res.status(400).json({
        success: false,
        error:
          `A categoria "${category}" ainda não possui um mapeamento gratuito configurado.`
      });
    }

    /*
     * 1. Localiza a cidade.
     */
    const location = await geocode(
      city,
      state
    );

    /*
     * 2. Busca empresas reais.
     */
    const result = await searchOverpass(
      location.lat,
      location.lon,
      tags
    );

    /*
     * 3. Remove duplicados.
     */
    const unique = new Map();

    for (const element of result.elements) {

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

      const key = normalize(name);

      if (!unique.has(key)) {
        unique.set(key, element);
      }
    }

    const elements = Array.from(
      unique.values()
    ).slice(0, 100);

    return res.status(200).json({

      success: true,

      source: {
        provider: 'OpenStreetMap',
        search_engine: 'Overpass',
        geocoder: 'Nominatim'
      },

      query: {
        category,
        city,
        state
      },

      location,

      count: elements.length,

      elements

    });

  } catch (error) {

    console.error(
      '[KS Leads] Free search error:',
      error
    );

    return res.status(502).json({

      success: false,

      error:
        'As fontes gratuitas estão temporariamente indisponíveis. Tente novamente em alguns segundos.',

      /*
       * Não expõe detalhes internos em produção.
       * O erro completo fica no log da Vercel.
       */
      detail:
        process.env.NODE_ENV === 'development'
          ? String(error?.message || error)
          : undefined

    });
  }
};
