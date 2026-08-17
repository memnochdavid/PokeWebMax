// Catálogo bilingüe estático de las 54 categorías y 8 "pockets" (bolsillos de la
// mochila) de objeto de PokeAPI — mismo criterio inline que TYPE_NAMES_ES en
// pokemonTypes.js: son etiquetas cortas, no hace falta ir por locales/*.json.
const CATEGORY_NAMES_ES = {
  'stat-boosts': 'Potenciadores de estadísticas',
  'effort-drop': 'Reductores de esfuerzo',
  medicine: 'Medicina',
  other: 'Otros',
  'in-a-pinch': 'Objetos de apuro',
  'picky-healing': 'Curación exigente',
  'type-protection': 'Protección de tipo',
  'baking-only': 'Solo para repostería',
  collectibles: 'Coleccionables',
  evolution: 'Objetos evolutivos',
  spelunking: 'Espeleología',
  'held-items': 'Objetos equipables',
  choice: 'Objetos Elección',
  'effort-training': 'Entrenamiento de esfuerzo',
  'bad-held-items': 'Objetos equipables perjudiciales',
  training: 'Entrenamiento',
  plates: 'Placas',
  'species-specific': 'Específicos de especie',
  'type-enhancement': 'Potenciadores de tipo',
  'event-items': 'Objetos de evento',
  gameplay: 'Objetos de juego',
  'plot-advancement': 'Objetos de trama',
  unused: 'Sin uso',
  loot: 'Botín',
  'all-mail': 'Correo',
  vitamins: 'Vitaminas',
  healing: 'Curación',
  'pp-recovery': 'Recuperación de PP',
  revival: 'Reanimación',
  'status-cures': 'Curación de estados',
  mulch: 'Abonos',
  'special-balls': 'Poké Balls especiales',
  'standard-balls': 'Poké Balls estándar',
  'dex-completion': 'Compleción de la Pokédex',
  scarves: 'Pañuelos',
  'all-machines': 'MT/MO',
  flutes: 'Flautas',
  'apricorn-balls': 'Balls de Manzano',
  'apricorn-box': 'Caja de Manzanos',
  'data-cards': 'Tarjetas de datos',
  jewels: 'Joyas',
  'miracle-shooter': 'Lanzamilagros',
  'mega-stones': 'Mega Piedras',
  memories: 'Memorias',
  'z-crystals': 'Cristales Z',
  'species-candies': 'Caramelos de especie',
  'catching-bonus': 'Bonificación de captura',
  'dynamax-crystals': 'Cristales Dynamax',
  'nature-mints': 'Mentas de naturaleza',
  'curry-ingredients': 'Ingredientes de curry',
  'tera-shard': 'Fragmentos Tera',
  'sandwich-ingredients': 'Ingredientes de sándwich',
  'tm-materials': 'Materiales de MT',
  picnic: 'Picnic',
}

const POCKET_NAMES_ES = {
  misc: 'Varios',
  medicine: 'Medicina',
  pokeballs: 'Poké Balls',
  machines: 'MT/MO',
  berries: 'Bayas',
  mail: 'Correo',
  battle: 'Batalla',
  key: 'Objetos clave',
}

// Los 8 `item-attribute` de PokeAPI (countable, consumable, usable-overworld...) —
// mismo criterio bilingüe inline que el resto de este fichero.
const ATTRIBUTE_NAMES_ES = {
  countable: 'Se puede tener en cantidad',
  consumable: 'Se consume al usarlo',
  'usable-overworld': 'Usable fuera de combate',
  'usable-in-battle': 'Usable en combate',
  holdable: 'Se puede llevar equipado',
  'holdable-passive': 'Efecto pasivo al llevarlo',
  'holdable-active': 'Efecto activo al llevarlo',
  underground: 'Objeto de Subterráneo',
}

export function itemAttributeName(slug, language) {
  if (!slug) return null
  if (language === 'es') return ATTRIBUTE_NAMES_ES[slug] ?? humanize(slug)
  return humanize(slug)
}

function humanize(slug) {
  return slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function itemCategoryName(slug, language) {
  if (!slug) return null
  if (language === 'es') return CATEGORY_NAMES_ES[slug] ?? humanize(slug)
  return humanize(slug)
}

export function itemPocketName(slug, language) {
  if (!slug) return null
  if (language === 'es') return POCKET_NAMES_ES[slug] ?? humanize(slug)
  return humanize(slug)
}

export const ITEM_POCKETS = Object.keys(POCKET_NAMES_ES)
