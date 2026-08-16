// Los 49 recursos reales de PokeAPI v2 (todo salvo `meta`, que es solo info de deploy),
// agrupados como en la documentación oficial. Fuente de verdad única para la vista
// Cachear — añadir un recurso nuevo aquí es lo único que hace falta, el backend ya es
// genérico para cualquier resourceType. Catálogo interno indexado por clave, no prosa
// de interfaz — por eso las etiquetas van bilingües inline ({es, en}) en vez de vivir
// en locales/*.json (mismo criterio que damageClassName en utils/pokemonFicha.js).
export const RESOURCE_GROUPS = [
  {
    label: { es: 'Pokémon', en: 'Pokémon' },
    resources: [
      { type: 'pokemon-species', label: { es: 'Pokémon (especies)', en: 'Pokémon (species)' } },
      { type: 'pokemon', label: { es: 'Pokémon (variantes/formas)', en: 'Pokémon (varieties/forms)' } },
      { type: 'ability', label: { es: 'Habilidades', en: 'Abilities' } },
      { type: 'characteristic', label: { es: 'Características', en: 'Characteristics' } },
      { type: 'egg-group', label: { es: 'Grupos huevo', en: 'Egg groups' } },
      { type: 'gender', label: { es: 'Géneros', en: 'Genders' } },
      { type: 'growth-rate', label: { es: 'Tasas de crecimiento', en: 'Growth rates' } },
      { type: 'nature', label: { es: 'Naturalezas', en: 'Natures' } },
      { type: 'pokeathlon-stat', label: { es: 'Estadísticas Pokéathlon', en: 'Pokéathlon stats' } },
      { type: 'pokemon-color', label: { es: 'Colores de Pokémon', en: 'Pokémon colors' } },
      { type: 'pokemon-form', label: { es: 'Formas de Pokémon', en: 'Pokémon forms' } },
      { type: 'pokemon-habitat', label: { es: 'Hábitats', en: 'Habitats' } },
      { type: 'pokemon-shape', label: { es: 'Siluetas', en: 'Shapes' } },
      { type: 'stat', label: { es: 'Estadísticas', en: 'Stats' } },
      { type: 'type', label: { es: 'Tipos', en: 'Types' } },
    ],
  },
  {
    label: { es: 'Movimientos', en: 'Moves' },
    resources: [
      { type: 'move', label: { es: 'Movimientos', en: 'Moves' } },
      { type: 'move-ailment', label: { es: 'Estados alterados', en: 'Move ailments' } },
      { type: 'move-battle-style', label: { es: 'Estilos de batalla', en: 'Battle styles' } },
      { type: 'move-category', label: { es: 'Categorías de movimiento', en: 'Move categories' } },
      { type: 'move-damage-class', label: { es: 'Clases de daño', en: 'Damage classes' } },
      { type: 'move-learn-method', label: { es: 'Métodos de aprendizaje', en: 'Learn methods' } },
      { type: 'move-target', label: { es: 'Objetivos de movimiento', en: 'Move targets' } },
    ],
  },
  {
    label: { es: 'Ítems', en: 'Items' },
    resources: [
      { type: 'item', label: { es: 'Ítems', en: 'Items' } },
      { type: 'item-attribute', label: { es: 'Atributos de ítem', en: 'Item attributes' } },
      { type: 'item-category', label: { es: 'Categorías de ítem', en: 'Item categories' } },
      { type: 'item-fling-effect', label: { es: 'Efectos de lanzar ítem', en: 'Item fling effects' } },
      { type: 'item-pocket', label: { es: 'Bolsillos de ítem', en: 'Item pockets' } },
      { type: 'machine', label: { es: 'Máquinas (MT/MO)', en: 'Machines (TM/HM)' } },
    ],
  },
  {
    label: { es: 'Bayas', en: 'Berries' },
    resources: [
      { type: 'berry', label: { es: 'Bayas', en: 'Berries' } },
      { type: 'berry-firmness', label: { es: 'Firmezas de baya', en: 'Berry firmnesses' } },
      { type: 'berry-flavor', label: { es: 'Sabores de baya', en: 'Berry flavors' } },
    ],
  },
  {
    label: { es: 'Ubicaciones', en: 'Locations' },
    resources: [
      { type: 'location', label: { es: 'Ubicaciones', en: 'Locations' } },
      { type: 'location-area', label: { es: 'Áreas de ubicación', en: 'Location areas' } },
      { type: 'pal-park-area', label: { es: 'Áreas de Pal Park', en: 'Pal Park areas' } },
      { type: 'region', label: { es: 'Regiones', en: 'Regions' } },
    ],
  },
  {
    label: { es: 'Encuentros', en: 'Encounters' },
    resources: [
      { type: 'encounter-method', label: { es: 'Métodos de encuentro', en: 'Encounter methods' } },
      { type: 'encounter-condition', label: { es: 'Condiciones de encuentro', en: 'Encounter conditions' } },
      { type: 'encounter-condition-value', label: { es: 'Valores de condición', en: 'Encounter condition values' } },
    ],
  },
  {
    label: { es: 'Evolución', en: 'Evolution' },
    resources: [
      { type: 'evolution-chain', label: { es: 'Cadenas evolutivas', en: 'Evolution chains' } },
      { type: 'evolution-trigger', label: { es: 'Disparadores de evolución', en: 'Evolution triggers' } },
    ],
  },
  {
    label: { es: 'Concursos', en: 'Contests' },
    resources: [
      { type: 'contest-type', label: { es: 'Tipos de concurso', en: 'Contest types' } },
      { type: 'contest-effect', label: { es: 'Efectos de concurso', en: 'Contest effects' } },
      { type: 'super-contest-effect', label: { es: 'Efectos de supercontest', en: 'Super contest effects' } },
    ],
  },
  {
    label: { es: 'Partidas', en: 'Games' },
    resources: [
      { type: 'generation', label: { es: 'Generaciones', en: 'Generations' } },
      { type: 'pokedex', label: { es: 'Pokédex', en: 'Pokédexes' } },
      { type: 'version', label: { es: 'Versiones', en: 'Versions' } },
      { type: 'version-group', label: { es: 'Grupos de versiones', en: 'Version groups' } },
    ],
  },
  {
    label: { es: 'Utilidad', en: 'Utility' },
    resources: [
      { type: 'language', label: { es: 'Idiomas', en: 'Languages' } },
      { type: 'currency', label: { es: 'Monedas', en: 'Currencies' } },
    ],
  },
]
