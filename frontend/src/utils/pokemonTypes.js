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

export function typeNameEs(type) {
  return TYPE_NAMES_ES[type] ?? type
}

export function typeIconUrl(type) {
  return new URL(`../assets/types/${type}.svg`, import.meta.url).href
}
