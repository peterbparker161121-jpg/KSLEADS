/**
 * KS Leads - busca pública gratuita
 * Proxy server-side para evitar CORS ao consultar Nominatim e Overpass.
 * Não usa Service Role nem APIs pagas.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const CATEGORY_TAGS = {
  dentist: ['amenity=dentist'],
  restaurant: ['amenity=restaurant'],
  pizzaria: ['amenity=restaurant'],
  bar: ['amenity=bar'],
  farmacia: ['amenity=pharmacy'],
  drogaria: ['amenity=pharmacy'],
  clinica: ['amenity=clinic', 'amenity=doctors'],
  medico: ['amenity=doctors'],
  academia: ['leisure=fitness_centre'],
  fitness: ['leisure=fitness_centre'],
  advogado: ['office=lawyer'],
  advocacia: ['office=lawyer'],
  oficina: ['shop=car_repair'],
  mecanica: ['shop=car_repair'],
  cabeleireiro: ['shop=hairdresser'],
  cabeleireira: ['shop=hairdresser'],
  barbearia: ['shop=hairdresser'],
  hotel: ['tourism=hotel'],
  pousada: ['tourism=guest_house'],
  mercado: ['shop=supermarket'],
  supermercado: ['shop=supermarket']
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeOverpass(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function categoryToTags(category) {
  const c = normalize(category);
  for (const [keyword, tags] of Object.entries(CATEGORY_TAGS)) {
    if (c.includes(keyword)) return tags;
  }
  // Para categorias livres, procuramos estabelecimentos com nome/tipo.
  // Não fabricamos resultados: a fonte precisa devolver uma empresa real.
  return ['name'];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(city, state) {
  const q = `${city}, ${state}, Brasil`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'KS-Leads/1.0 (lead search)'
    }
  }, 15000);

  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error(`Cidade não localizada: ${city}/${state}`);
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    display: data[0].display_name
  };
}

async function overpass(lat, lon, tags) {
  const radius = 15000;
  const clauses = tags.map(tag => {
    if (tag === 'name') return `nwr["name"](around:${radius},${lat},${lon});`;
    const [key, value] = tag.split('=');
    return `nwr["${escapeOverpass(key)}"="${escapeOverpass(value)}"](around:${radius},${lat},${lon});`;
  }).join('\n');

  const query = `[out:json][timeout:25];(${clauses});out center tags;`;
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        `${endpoint}?data=${encodeURIComponent(query)}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'KS-Leads/1.0' } },
        35000
      );
      if (!response.ok) {
        lastError = new Error(`Overpass HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      return Array.isArray(data.elements) ? data.elements : [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Serviços gratuitos de mapas indisponíveis.');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { category, city, state } = req.body || {};

    if (!category || !city || !state) {
      return res.status(400).json({ error: 'Categoria, cidade e estado são obrigatórios.' });
    }

    const location = await geocode(String(city).trim(), String(state).trim().toUpperCase());
    const tags = categoryToTags(category);
    const elements = await overpass(location.lat, location.lon, tags);

    return res.status(200).json({
      success: true,
      source: 'OpenStreetMap / Nominatim / Overpass',
      location,
      elements: elements.slice(0, 100)
    });
  } catch (error) {
    console.error('[KS Leads free search]', error);
    return res.status(502).json({
      error: 'As fontes gratuitas de mapas não responderam. Tente novamente em alguns segundos.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
