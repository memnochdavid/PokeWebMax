// Colores oficiales por tipo (portados de DexterWeb, mismo criterio visual que la app
// Android de referencia). Los iconos SVG viven en assets/types/{type}.svg.
export const TYPE_COLORS = {
  normal: '#989998',
  fire: '#E62829',
  water: '#2980EF',
  electric: '#F0B800',
  grass: '#3FA129',
  ice: '#3FD8FF',
  fighting: '#FF8000',
  poison: '#8F41CB',
  ground: '#8A4D1F',
  flying: '#79AEE1',
  psychic: '#EB4077',
  bug: '#849217',
  rock: '#A7A17B',
  ghost: '#653A65',
  dragon: '#5061E0',
  dark: '#50413F',
  steel: '#60A1B8',
  fairy: '#EF71EF',
}

const TYPE_NAMES_ES = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
}

export const ALL_TYPES = Object.keys(TYPE_COLORS)

export function typeColor(type) {
  return TYPE_COLORS[type] ?? '#aaaaaa'
}

// El slug de PokeAPI ya ES el nombre en inglés (fire, water, grass...), así que para
// cualquier idioma que no sea español basta con capitalizarlo — no hace falta una
// tabla traducida para cada uno de los 18 tipos en cada idioma del selector.
export function typeName(type, language) {
  if (language === 'es') return TYPE_NAMES_ES[type] ?? type
  return type.length > 0 ? type[0].toUpperCase() + type.slice(1) : type
}

export function typeIconUrl(type) {
  return new URL(`../assets/types/${type}.svg`, import.meta.url).href
}
