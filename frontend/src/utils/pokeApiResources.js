// Los 49 recursos reales de PokeAPI v2 (todo salvo `meta`, que es solo info de deploy),
// agrupados como en la documentación oficial. Fuente de verdad única para la vista
// Cachear — añadir un recurso nuevo aquí es lo único que hace falta, el backend ya es
// genérico para cualquier resourceType.
export const RESOURCE_GROUPS = [
  {
    label: 'Pokémon',
    resources: [
      { type: 'pokemon-species', label: 'Pokémon (especies)' },
      { type: 'pokemon', label: 'Pokémon (variantes/formas)' },
      { type: 'ability', label: 'Habilidades' },
      { type: 'characteristic', label: 'Características' },
      { type: 'egg-group', label: 'Grupos huevo' },
      { type: 'gender', label: 'Géneros' },
      { type: 'growth-rate', label: 'Tasas de crecimiento' },
      { type: 'nature', label: 'Naturalezas' },
      { type: 'pokeathlon-stat', label: 'Estadísticas Pokéathlon' },
      { type: 'pokemon-color', label: 'Colores de Pokémon' },
      { type: 'pokemon-form', label: 'Formas de Pokémon' },
      { type: 'pokemon-habitat', label: 'Hábitats' },
      { type: 'pokemon-shape', label: 'Siluetas' },
      { type: 'stat', label: 'Estadísticas' },
      { type: 'type', label: 'Tipos' },
    ],
  },
  {
    label: 'Movimientos',
    resources: [
      { type: 'move', label: 'Movimientos' },
      { type: 'move-ailment', label: 'Estados alterados' },
      { type: 'move-battle-style', label: 'Estilos de batalla' },
      { type: 'move-category', label: 'Categorías de movimiento' },
      { type: 'move-damage-class', label: 'Clases de daño' },
      { type: 'move-learn-method', label: 'Métodos de aprendizaje' },
      { type: 'move-target', label: 'Objetivos de movimiento' },
    ],
  },
  {
    label: 'Ítems',
    resources: [
      { type: 'item', label: 'Ítems' },
      { type: 'item-attribute', label: 'Atributos de ítem' },
      { type: 'item-category', label: 'Categorías de ítem' },
      { type: 'item-fling-effect', label: 'Efectos de lanzar ítem' },
      { type: 'item-pocket', label: 'Bolsillos de ítem' },
      { type: 'machine', label: 'Máquinas (MT/MO)' },
    ],
  },
  {
    label: 'Bayas',
    resources: [
      { type: 'berry', label: 'Bayas' },
      { type: 'berry-firmness', label: 'Firmezas de baya' },
      { type: 'berry-flavor', label: 'Sabores de baya' },
    ],
  },
  {
    label: 'Ubicaciones',
    resources: [
      { type: 'location', label: 'Ubicaciones' },
      { type: 'location-area', label: 'Áreas de ubicación' },
      { type: 'pal-park-area', label: 'Áreas de Pal Park' },
      { type: 'region', label: 'Regiones' },
    ],
  },
  {
    label: 'Encuentros',
    resources: [
      { type: 'encounter-method', label: 'Métodos de encuentro' },
      { type: 'encounter-condition', label: 'Condiciones de encuentro' },
      { type: 'encounter-condition-value', label: 'Valores de condición' },
    ],
  },
  {
    label: 'Evolución',
    resources: [
      { type: 'evolution-chain', label: 'Cadenas evolutivas' },
      { type: 'evolution-trigger', label: 'Disparadores de evolución' },
    ],
  },
  {
    label: 'Concursos',
    resources: [
      { type: 'contest-type', label: 'Tipos de concurso' },
      { type: 'contest-effect', label: 'Efectos de concurso' },
      { type: 'super-contest-effect', label: 'Efectos de supercontest' },
    ],
  },
  {
    label: 'Partidas',
    resources: [
      { type: 'generation', label: 'Generaciones' },
      { type: 'pokedex', label: 'Pokédex' },
      { type: 'version', label: 'Versiones' },
      { type: 'version-group', label: 'Grupos de versiones' },
    ],
  },
  {
    label: 'Utilidad',
    resources: [
      { type: 'language', label: 'Idiomas' },
      { type: 'currency', label: 'Monedas' },
    ],
  },
]
