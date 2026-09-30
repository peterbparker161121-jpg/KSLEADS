/**
 * KS LEADS
 * Motor real de descoberta gratuita de empresas
 *
 * NÃO GERA DADOS FALSOS.
 *
 * Fluxo:
 * 1. Localiza a cidade pelo Nominatim.
 * 2. Obtém o bounding box real da cidade.
 * 3. Consulta estabelecimentos dentro desse box pelo Overpass.
 * 4. Se não encontrar, tenta uma segunda estratégia por coordenadas.
 * 5. Tenta múltiplos servidores Overpass.
 */

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const NOMINATIM_ENDPOINT =
  'https://nominatim.openstreetmap.org/search';

const USER_AGENT =
  'KS-Leads/1.0 (+https://ksleads.vercel.app)';

const CATEGORY_MAP = {
  dentist: [
    ['amenity', 'dentist'],
    ['healthcare', 'dentist']
  ],

  dentista: [
    ['amenity', 'dentist'],
    ['healthcare', 'dentist']
  ],

  odontologia: [
    ['amenity', 'dentist'],
    ['healthcare', 'dentist']
  ],

  odontologico: [
    ['amenity', 'dentist'],
    ['healthcare', 'dentist']
  ],

  odontologica: [
    ['amenity', 'dentist'],
    ['healthcare', 'dentist']
  ],

  restaurante: [
    ['amenity', 'restaurant']
  ],

  restaurantes: [
    ['amenity', 'restaurant']
  ],

  pizzaria: [
    ['amenity', 'restaurant']
  ],

  pizza: [
    ['amenity', 'restaurant']
  ],

  bar: [
    ['amenity', 'bar']
  ],

  farmacia: [
    ['amenity', 'pharmacy']
  ],

  farmacia: [
    ['amenity', 'pharmacy']
  ],

  drogaria: [
    ['amenity', 'pharmacy']
  ],

  clinica: [
    ['amenity', 'clinic'],
    ['amenity', 'doctors'],
    ['healthcare', 'clinic'],
    ['healthcare', 'doctor']
  ],

  medico: [
    ['amenity', 'doctors'],
    ['healthcare', 'doctor']
  ],

  academia: [
    ['leisure', 'fitness_centre']
  ],

  fitness: [
    ['leisure', 'fitness_centre']
  ],

  advogado: [
    ['office', 'lawyer']
  ],

  advocacia: [
    ['office', 'lawyer']
  ],

  oficina: [
    ['shop', 'car_repair']
  ],

  mecanica: [
    ['shop', 'car_repair']
  ],

  cabeleireiro: [
    ['shop', 'hairdresser']
  ],

  cabeleireira: [
    ['shop', 'hairdresser']
  ],

  barbearia: [
    ['shop', 'hairdresser']
  ],

  hotel: [
    ['tourism', 'hotel']
  ],

  pousada: [
    ['tourism', 'guest_house']
  ],

  mercado: [
    ['shop', 'supermarket']
  ],

  supermercado: [
    ['shop', 'supermarket']
  ]
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegex(value) {
  return String(value || '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeOverpass(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
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

/* =========================================================
   CATEGORIA
========================================================= */

function getCategoryKey(category) {
  const normalized = normalize(category);

  if (
    normalized.includes('dent')
    || normalized.includes('odonto')
  ) {
    return 'dentista';
  }

  if (normalized.includes('pizza')) {
    return 'pizzaria';
  }

  if (normalized.includes('restaurante')) {
    return 'restaurante';
  }

  if (normalized.includes('farm')) {
    return 'farmacia';
  }

  if (normalized.includes('drog')) {
    return 'drogaria';
  }

  if (normalized.includes('barbear')) {
    return 'barbearia';
  }

  if (normalized.includes('cabeleir')) {
    return 'cabeleireiro';
  }

  if (normalized.includes('advoc')) {
    return 'advocacia';
  }

  if (normalized.includes('advog')) {
    return 'advogado';
  }

  if (normalized.includes('mecan')) {
    return 'mecanica';
  }

  if (normalized.includes('oficina')) {
    return 'oficina';
  }

  if (normalized.includes('academ')) {
    return 'academia';
  }

  if (normalized.includes('hotel')) {
    return 'hotel';
  }

  if (normalized.includes('pousad')) {
    return 'pousada';
  }

  if (
    normalized.includes('supermerc')
    || normalized.includes('super mercado')
  ) {
    return 'supermercado';
  }

  if (normalized.includes('mercado')) {
    return 'mercado';
  }

  if (normalized.includes('clin')) {
    return 'clinica';
  }

  if (
    normalized.includes('medic')
    || normalized.includes('doutor')
    || normalized.includes('dr ')
  ) {
    return 'medico';
  }

  return normalized;
}

function getCategoryTags(category) {
  const key = getCategoryKey(category);

  return CATEGORY_MAP[key] || null;
}

/* =========================================================
   LOCALIZAÇÃO
========================================================= */

async function geocodeCity(city, state) {
  const params = new URLSearchParams();

  params.set('format', 'jsonv2');
  params.set('limit', '5');
  params.set('countrycodes', 'br');
  params.set('addressdetails', '1');

  params.set('city', city);
  params.set('state', state);
  params.set('country', 'Brasil');

  const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      }
    },
    12000
  );

  if (!response.ok) {
    throw new Error(
      `Nominatim HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Cidade não localizada: ${city}/${state}`
    );
  }

  /*
   * Priorizamos resultado que seja cidade/município.
   */
  const normalizedCity = normalize(city);

  const candidates = data.filter(item => {
    const type = normalize(item.type);
    const display = normalize(item.display_name);

    return (
      display.includes(normalizedCity)
      &&
      (
        type === 'city'
        || type === 'town'
        || type === 'municipality'
        || type === 'administrative'
        || type === 'village'
      )
    );
  });

  const result = candidates[0] || data[0];

  if (!result.lat || !result.lon) {
    throw new Error(
      `Localização inválida para ${city}/${state}`
    );
  }

  let bbox = null;

  if (
    Array.isArray(result.boundingbox)
    &&
    result.boundingbox.length === 4
  ) {
    const south = Number(result.boundingbox[0]);
    const north = Number(result.boundingbox[1]);
    const west = Number(result.boundingbox[2]);
    const east = Number(result.boundingbox[3]);

    if (
      Number.isFinite(south)
      &&
      Number.isFinite(north)
      &&
      Number.isFinite(west)
      &&
      Number.isFinite(east)
    ) {
      bbox = {
        south,
        west,
        north,
        east
      };
    }
  }

  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    display: result.display_name,
    bbox
  };
}

/* =========================================================
   OVERPASS
========================================================= */

function buildBboxString(bbox) {
  return [
    bbox.south,
    bbox.west,
    bbox.north,
    bbox.east
  ].join(',');
}

function buildCategoryClauses(category, bbox) {
  const tags = getCategoryTags(category);

  if (!tags) {
    const escaped = escapeOverpass(category);

    return `
      nwr["name"~"${escaped}",i"](${buildBboxString(bbox)});
    `;
  }

  return tags
    .map(([key, value]) => {
      return `
        nwr[
          "${escapeOverpass(key)}"="${escapeOverpass(value)}"
        ](${buildBboxString(bbox)});
      `;
    })
    .join('\n');
}

function buildNameFallback(category, bbox) {
  const key = getCategoryKey(category);

  const regexMap = {
    dentista:
      'dentista|dentistas|odontologia|odontologico|odontologica|odonto|clinica odontologica|consultorio odontologico',

    restaurante:
      'restaurante|restaurant',

    pizzaria:
      'pizzaria|pizza',

    farmacia:
      'farmacia|farmacia',

    drogaria:
      'drogaria',

    barbearia:
      'barbearia|barbeiro',

    cabeleireiro:
      'cabeleireiro|cabeleireira|salao',

    advogado:
      'advogado|advocacia',

    advocacia:
      'advogado|advocacia',

    oficina:
      'oficina|mecanica|mecanica',

    mecanica:
      'oficina|mecanica|mecanico',

    academia:
      'academia|fitness',

    clinica:
      'clinica|clinic',

    medico:
      'medico|medicina|doctor|consultorio',

    hotel:
      'hotel',

    pousada:
      'pousada',

    mercado:
      'mercado|supermercado',

    supermercado:
      'supermercado|mercado'
  };

  const regex =
    regexMap[key] ||
    escapeRegex(category);

  return `
    nwr[
      "name"~"${regex}",i"
    ](${buildBboxString(bbox)});
  `;
}

function buildPrimaryQuery(category, bbox) {
  const clauses =
    buildCategoryClauses(category, bbox);

  return `
    [out:json][timeout:30];

    (
      ${clauses}
    );

    out center tags;
  `;
}

function buildFallbackQuery(category, bbox) {
  const clauses =
    buildNameFallback(category, bbox);

  return `
    [out:json][timeout:30];

    (
      ${clauses}
    );

    out center tags;
  `;
}

async function requestOverpass(endpoint, query) {
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded;charset=UTF-8',

        'Accept':
          'application/json',

        'User-Agent':
          USER_AGENT
      },

      body:
        `data=${encodeURIComponent(query)}`
    },
    35000
  );

  if (!response.ok) {
    throw new Error(
      `Overpass HTTP ${response.status}`
    );
  }

  const text = await response.text();

  if (!text) {
    throw new Error(
      'Overpass retornou resposta vazia.'
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      'Overpass retornou resposta inválida.'
    );
  }

  if (!data || !Array.isArray(data.elements)) {
    throw new Error(
      'Resposta Overpass sem elementos.'
    );
  }

  return data.elements;
}

async function queryOverpass(query) {
  let lastError = null;

  /*
   * Testa os servidores em paralelo.
   * O primeiro que responder corretamente vence.
   */
  const requests =
    OVERPASS_ENDPOINTS.map(async endpoint => {
      try {
        const elements =
          await requestOverpass(
            endpoint,
            query
          );

        return {
          endpoint,
          elements
        };
      } catch (error) {
        lastError = error;
        throw error;
      }
    });

  try {
    const result =
      await Promise.any(requests);

    return result;
  } catch {
    throw (
      lastError ||
      new Error(
        'Nenhum servidor Overpass respondeu.'
      )
    );
  }
}

/* =========================================================
   DISTÂNCIA
========================================================= */

function distanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI /
    180;

  const dLon =
    (lon2 - lon1) *
    Math.PI /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

/* =========================================================
   LIMPEZA
========================================================= */

function getElementCoordinates(element) {
  if (
    element.lat != null &&
    element.lon != null
  ) {
    return {
      lat: Number(element.lat),
      lon: Number(element.lon)
    };
  }

  if (
    element.center &&
    element.center.lat != null &&
    element.center.lon != null
  ) {
    return {
      lat: Number(element.center.lat),
      lon: Number(element.center.lon)
    };
  }

  return null;
}

function cleanElements(
  elements,
  cityLocation
) {
  const seen = new Set();

  const cleaned = [];

  for (const element of elements || []) {
    const tags =
      element &&
      element.tags
        ? element.tags
        : {};

    const name =
      tags.name ||
      tags.brand ||
      tags.operator;

    if (!name) {
      continue;
    }

    const coords =
      getElementCoordinates(element);

    if (!coords) {
      continue;
    }

    if (
      !Number.isFinite(coords.lat) ||
      !Number.isFinite(coords.lon)
    ) {
      continue;
    }

    /*
     * Evita resultados completamente fora da cidade.
     *
     * Quando temos bounding box, usamos uma margem pequena.
     */
    if (cityLocation.bbox) {
      const b = cityLocation.bbox;

      const marginLat = 0.02;
      const marginLon = 0.02;

      const inside =
        coords.lat >= b.south - marginLat &&
        coords.lat <= b.north + marginLat &&
        coords.lon >= b.west - marginLon &&
        coords.lon <= b.east + marginLon;

      if (!inside) {
        continue;
      }
    } else {
      /*
       * Fallback de segurança: máximo 25 km
       * do centro da cidade.
       */
      const distance =
        distanceKm(
          cityLocation.lat,
          cityLocation.lon,
          coords.lat,
          coords.lon
        );

      if (distance > 25) {
        continue;
      }
    }

    const id =
      `${element.type}:${element.id}`;

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);

    cleaned.push(element);
  }

  /*
   * Ordena por distância do centro da cidade.
   */
  cleaned.sort((a, b) => {
    const ca =
      getElementCoordinates(a);

    const cb =
      getElementCoordinates(b);

    if (!ca || !cb) {
      return 0;
    }

    const da =
      distanceKm(
        cityLocation.lat,
        cityLocation.lon,
        ca.lat,
        ca.lon
      );

    const db =
      distanceKm(
        cityLocation.lat,
        cityLocation.lon,
        cb.lat,
        cb.lon
      );

    return da - db;
  });

  return cleaned;
}

/* =========================================================
   BUSCA PRINCIPAL
========================================================= */

async function searchRealLeads(
  category,
  city,
  state
) {
  const location =
    await geocodeCity(
      city,
      state
    );

  /*
   * 1º tentativa:
   * tags oficiais da categoria.
   */
  const primaryQuery =
    buildPrimaryQuery(
      category,
      location.bbox
    );

  let result;

  try {
    result =
      await queryOverpass(
        primaryQuery
      );
  } catch (error) {
    console.error(
      '[KS Leads] Erro consulta principal:',
      error
    );

    result = {
      endpoint: null,
      elements: []
    };
  }

  let elements =
    cleanElements(
      result.elements,
      location
    );

  /*
   * 2º tentativa:
   * busca pelo nome.
   *
   * Isso é importante porque estabelecimentos
   * podem estar cadastrados no OSM com tags diferentes.
   */
  if (elements.length === 0) {
    console.log(
      '[KS Leads] Consulta principal sem resultados. Tentando fallback por nome.'
    );

    const fallbackQuery =
      buildFallbackQuery(
        category,
        location.bbox
      );

    try {
      result =
        await queryOverpass(
          fallbackQuery
        );

      elements =
        cleanElements(
          result.elements,
          location
        );
    } catch (error) {
      console.error(
        '[KS Leads] Erro fallback por nome:',
        error
      );
    }
  }

  /*
   * 3º tentativa:
   * caso o bounding box do Nominatim seja ruim,
   * usa um raio maior em torno da cidade.
   */
  if (elements.length === 0) {
    console.log(
      '[KS Leads] Nenhum resultado no bounding box. Tentando busca por raio.'
    );

    const tags =
      getCategoryTags(category);

    const radius =
      25000;

    let clauses = '';

    if (tags) {
      clauses =
        tags
          .map(([key, value]) => {
            return `
              nwr[
                "${escapeOverpass(key)}"="${escapeOverpass(value)}"
              ](
                around:${radius},
                ${location.lat},
                ${location.lon}
              );
            `;
          })
          .join('\n');
    } else {
      const regex =
        escapeRegex(category);

      clauses = `
        nwr[
          "name"~"${regex}",i"
        ](
          around:${radius},
          ${location.lat},
          ${location.lon}
        );
      `;
    }

    const radiusQuery = `
      [out:json][timeout:35];

      (
        ${clauses}
      );

      out center tags;
    `;

    try {
      result =
        await queryOverpass(
          radiusQuery
        );

      elements =
        cleanElements(
          result.elements,
          {
            ...location,
            bbox: null
          }
        );
    } catch (error) {
      console.error(
        '[KS Leads] Erro busca por raio:',
        error
      );
    }
  }

  if (elements.length === 0) {
    throw new Error(
      `Nenhuma empresa real foi encontrada para "${category}" em ${city}/${state}.`
    );
  }

  return {
    location,
    elements,
    endpoint:
      result && result.endpoint
        ? result.endpoint
        : null
  };
}

/* =========================================================
   VERCEL HANDLER
========================================================= */

module.exports = async function handler(
  req,
  res
) {
  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error:
        'Método não permitido.'
    });
  }

  try {
    const body =
      req.body || {};

    const category =
      String(
        body.category || ''
      ).trim();

    const city =
      String(
        body.city || ''
      ).trim();

    const state =
      String(
        body.state || ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    if (
      !category ||
      !city ||
      !state
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Categoria, cidade e estado são obrigatórios.'
      });
    }

    console.log(
      `[KS Leads] Busca real: ${category} | ${city}/${state}`
    );

    const result =
      await searchRealLeads(
        category,
        city,
        state
      );

    return res.status(200).json({
      success: true,

      source:
        'OpenStreetMap / Nominatim / Overpass',

      query: {
        category,
        city,
        state
      },

      location: {
        lat:
          result.location.lat,

        lon:
          result.location.lon,

        display:
          result.location.display
      },

      count:
        result.elements.length,

      elements:
        result.elements.slice(0, 100)
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
        'Não foi possível realizar a busca real.',

      elements: []
    });
  }
};
