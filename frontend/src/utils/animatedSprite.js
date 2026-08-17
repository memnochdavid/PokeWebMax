// Traduce el slug de PokeAPI (pokemon.name, ej. "raichu-alola") al nombre de archivo
// del pack animado en public/animated/ (carpeta gitignored — assets con copyright,
// copiados manualmente por David, no se suben al repo). Puerto del criterio que ya
// usaba la app Android de referencia (transformPokemonNameToResourceName en
// SpriteWebm.kt) para las formas regionales/mega/de género, adaptado a que aquí
// siempre partimos del slug en inglés de PokeAPI en vez del nombre localizado.
const NAME_OVERRIDES = {
  'type-null': 'codigo_cero',

  // Formas con nombre propio en español que no encaja en ningún sufijo del switch
  // de abajo (auditado comparando animatedSpriteResourceName() contra los ficheros
  // reales del pack — ver .claude/memory/project_pokewebmax_progress.md).
  'aegislash-blade': 'aegislash_filo',
  vivillon: 'vivillon_floral',
  'toxtricity-amped': 'toxtricity_aguda',
  'toxtricity-low-key': 'toxtricity_grave',
  'toxtricity-amped-gmax': 'toxtricity_aguda',
  'toxtricity-low-key-gmax': 'toxtricity_grave',

  // Gigantamax / Totem / gorras cosméticas de Pikachu / tamaños de Pumpkaboo-Gourgeist:
  // no hay animación específica en el pack, se reutiliza la de la forma base.
  'alcremie-gmax': 'alcremie',
  'appletun-gmax': 'appletun',
  'araquanid-totem': 'araquanid',
  'blastoise-gmax': 'blastoise',
  'butterfree-gmax': 'butterfree',
  'centiskorch-gmax': 'centiskorch',
  'charizard-gmax': 'charizard',
  'cinderace-gmax': 'cinderace',
  'coalossal-gmax': 'coalossal',
  'copperajah-gmax': 'copperajah',
  'corviknight-gmax': 'corviknight',
  'drednaw-gmax': 'drednaw',
  'duraludon-gmax': 'duraludon',
  'eevee-gmax': 'eevee',
  'eevee-starter': 'eevee',
  'flapple-gmax': 'flapple',
  'garbodor-gmax': 'garbodor',
  'gengar-gmax': 'gengar',
  'gourgeist-average': 'gourgeist',
  'gourgeist-large': 'gourgeist',
  'gourgeist-small': 'gourgeist',
  'gourgeist-super': 'gourgeist',
  'grimmsnarl-gmax': 'grimmsnarl',
  'gumshoos-totem': 'gumshoos',
  'hatterene-gmax': 'hatterene',
  'inteleon-gmax': 'inteleon',
  'kingler-gmax': 'kingler',
  'koraidon-gliding-build': 'koraidon',
  'koraidon-limited-build': 'koraidon',
  'koraidon-sprinting-build': 'koraidon',
  'koraidon-swimming-build': 'koraidon',
  'lapras-gmax': 'lapras',
  'lurantis-totem': 'lurantis',
  'machamp-gmax': 'machamp',
  'melmetal-gmax': 'melmetal',
  'meowth-gmax': 'meowth',
  'mimikyu-totem-busted': 'mimikyu_descubierto',
  'mimikyu-totem-disguised': 'mimikyu',
  'miraidon-aquatic-mode': 'miraidon',
  'miraidon-drive-mode': 'miraidon',
  'miraidon-glide-mode': 'miraidon',
  'miraidon-low-power-mode': 'miraidon',
  'orbeetle-gmax': 'orbeetle',
  'pikachu-alola-cap': 'pikachu',
  'pikachu-belle': 'pikachu',
  'pikachu-cosplay': 'pikachu',
  'pikachu-gmax': 'pikachu',
  'pikachu-libre': 'pikachu',
  'pikachu-partner-cap': 'pikachu',
  'pikachu-phd': 'pikachu',
  'pikachu-pop-star': 'pikachu',
  'pikachu-rock-star': 'pikachu',
  'pikachu-starter': 'pikachu',
  'pikachu-unova-cap': 'pikachu',
  'pikachu-world-cap': 'pikachu',
  'pumpkaboo-average': 'pumpkaboo',
  'pumpkaboo-large': 'pumpkaboo',
  'pumpkaboo-small': 'pumpkaboo',
  'pumpkaboo-super': 'pumpkaboo',
  'raticate-totem-alola': 'raticate_de_alola',
  'ribombee-totem': 'ribombee',
  'rillaboom-gmax': 'rillaboom',
  'rockruff-own-tempo': 'rockruff',
  'salazzle-totem': 'salazzle',
  'sandaconda-gmax': 'sandaconda',
  'snorlax-gmax': 'snorlax',
  'togedemaru-totem': 'togedemaru',
  'urshifu-rapid-strike-gmax': 'urshifu_fluido',
  'urshifu-single-strike-gmax': 'urshifu_brusco',
  'venusaur-gmax': 'venusaur',
  'vikavolt-totem': 'vikavolt',

  // Formas alternativas con nombre oficial propio en español.
  'basculegion-female': 'basculegion_hembra',
  'basculegion-male': 'basculegion',
  'basculin-blue-striped': 'basculin_azul',
  'basculin-red-striped': 'basculin_roja',
  'basculin-white-striped': 'basculin_blanca',
  burmy: 'burmy_planta',
  'calyrex-ice': 'calyrex_jinete_glacial',
  'calyrex-shadow': 'calyrex_jinete_espectral',
  'castform-rainy': 'castform_lluvia',
  'castform-snowy': 'castform_nieve',
  'castform-sunny': 'castform_sol',
  cherrim: 'cherrim_encapotado',
  'cramorant-gorging': 'cramorant_tragatodo',
  'cramorant-gulping': 'cramorant_engulletodo',
  deerling: 'deerling_primavera',
  'deoxys-attack': 'deoxys_ataque',
  'deoxys-defense': 'deoxys_defensa',
  'deoxys-normal': 'deoxys',
  'deoxys-speed': 'deoxys_velocidad',
  'dialga-origin': 'dialga_origen',
  'dudunsparce-three-segment': 'dudunsparce_trinodular',
  'dudunsparce-two-segment': 'dudunsparce_binodular',
  'eiscue-ice': 'eiscue',
  'eiscue-noice': 'eiscue_cara_deshielo',
  'enamorus-incarnate': 'enamorus_avatar',
  'enamorus-therian': 'enamorus_totem',
  'eternatus-eternamax': 'eternatus',
  'greninja-battle-bond': 'greninja_ash',
  'marowak-totem': 'marowak_de_alola',
  terapagos: 'terapagos_normal',
  'thundurus-incarnate': 'thundurus_avatar',
  'thundurus-therian': 'thundurus_totem',
  'tornadus-incarnate': 'tornadus_avatar',
  'tornadus-therian': 'tornadus_totem',
  flabebe: 'flabebe_roja',
  floette: 'floette_roja',
  'floette-eternal': 'floette_eterna',
  florges: 'florges_roja',
  'frillish-male': 'frillish',
  gastrodon: 'gastrodon_oeste',
  gimmighoul: 'gimmighoul_cofre',
  'gimmighoul-roaming': 'gimmighoul_andante',
  'giratina-altered': 'giratina_modificada',
  'giratina-origin': 'giratina_origen',
  'groudon-primal': 'groudon_primigenio',
  'hoopa-unbound': 'hoopa_desatado',
  'indeedee-female': 'indeedee_hembra',
  'indeedee-male': 'indeedee',
  'jellicent-male': 'jellicent',
  'keldeo-ordinary': 'keldeo',
  'keldeo-resolute': 'keldeo_brio',
  'kyogre-primal': 'kyogre_primigenio',
  'kyurem-black': 'kyurem_negro',
  'kyurem-white': 'kyurem_blanco',
  'landorus-incarnate': 'landorus_avatar',
  'landorus-therian': 'landorus_totem',
  'lycanroc-dusk': 'lycanroc_crepuscular',
  'lycanroc-midday': 'lycanroc_diurno',
  'lycanroc-midnight': 'lycanroc_nocturno',
  'magearna-original': 'magearna_vetusta',
  'magearna-original-mega': 'magearna_vetusta',
  'maushold-family-of-four': 'maushold_familia_de_cuatro',
  'maushold-family-of-three': 'maushold_familia_de_tres',
  'meloetta-aria': 'meloetta_lirica',
  'meloetta-pirouette': 'meloetta_danza',
  'meowstic-female': 'meowstic_hembra',
  'meowstic-female-mega': 'meowstic_hembra',
  'meowstic-male': 'meowstic',
  'meowstic-male-mega': 'meowstic',
  'mimikyu-busted': 'mimikyu_descubierto',
  'mimikyu-disguised': 'mimikyu',
  'minior-blue': 'minior_azul',
  'minior-blue-meteor': 'minior_meteorito',
  'minior-green': 'minior_verde',
  'minior-green-meteor': 'minior_meteorito',
  'minior-indigo': 'minior_anil',
  'minior-indigo-meteor': 'minior_meteorito',
  'minior-orange': 'minior_naranja',
  'minior-orange-meteor': 'minior_meteorito',
  'minior-red': 'minior_rojo',
  'minior-red-meteor': 'minior_meteorito',
  'minior-violet': 'minior_violeta',
  'minior-violet-meteor': 'minior_meteorito',
  'minior-yellow': 'minior_amarillo',
  'minior-yellow-meteor': 'minior_meteorito',
  'morpeko-full-belly': 'morpeko',
  'morpeko-hangry': 'morpeko_voraz',
  'necrozma-dawn': 'necrozma_alas_del_alba',
  'necrozma-dusk': 'necrozma_melena_crepuscular',
  'necrozma-ultra': 'necrozma',
  ogerpon: 'ogerpon_mascara_turquesa',
  'ogerpon-cornerstone-mask': 'ogerpon_mascara_cimiento',
  'ogerpon-hearthflame-mask': 'ogerpon_mascara_horno',
  'ogerpon-wellspring-mask': 'ogerpon_mascara_fuente',
  'oinkologne-female': 'oinkologne_hembra',
  'oinkologne-male': 'oinkologne',
  'oricorio-baile': 'oricorio_apasionado',
  'oricorio-pau': 'oricorio_placido',
  'oricorio-pom-pom': 'oricorio_animado',
  'oricorio-sensu': 'oricorio_refinado',
  'palafin-hero': 'palafin_heroica',
  'palafin-zero': 'palafin_ingenua',
  'palkia-origin': 'palkia_origen',
  'pyroar-male': 'pyroar',
  'darmanitan-standard': 'darmanitan',
  'darmanitan-zen': 'darmanitan_daruma',
  sawsbuck: 'sawsbuck_primavera',
  'shaymin-land': 'shaymin_tierra',
  'shaymin-sky': 'shaymin_cielo',
  shellos: 'shellos_oeste',
  'squawkabilly-blue-plumage': 'squawkabilly_azul',
  'squawkabilly-green-plumage': 'squawkabilly_verde',
  'squawkabilly-white-plumage': 'squawkabilly_blanco',
  'squawkabilly-yellow-plumage': 'squawkabilly_amarillo',
  'tatsugiri-curly': 'tatsugiri_curvada',
  'tatsugiri-curly-mega': 'tatsugiri_curvada',
  'tatsugiri-droopy': 'tatsugiri_languida',
  'tatsugiri-droopy-mega': 'tatsugiri_languida',
  'tatsugiri-stretchy': 'tatsugiri_recta',
  'tatsugiri-stretchy-mega': 'tatsugiri_recta',
  'terapagos-stellar': 'terapagos_teracristal',
  'terapagos-terastal': 'terapagos_teracristal',
  unown: 'unown_a',
  // Las 28 formas de Unown (letras A-Z + !/?) son `pokemon-form` de un único `pokemon`
  // (no `species.varieties`, mismo caso que Alcremie, ver más abajo) — el selector de
  // decoración las referencia por su `pokemon.forms[].name`. La mayoría de letras
  // sueltas ('unown-b', 'unown-c'...) ya encajan en el switch por defecto de abajo
  // (`unown_b`, `unown_c`...); estas cuatro necesitan override: exclamación/pregunta
  // porque el pack usa nombre en español, y las letras F/M porque colisionan con los
  // casos 'f'/'m' del switch (pensados para sufijos de género tipo 'pikachu-f', no
  // para letras de Unown).
  'unown-exclamation': 'unown_exclamacion',
  'unown-question': 'unown_pregunta',
  'unown-f': 'unown_f',
  'unown-m': 'unown_m',
  'ursaluna-bloodmoon': 'ursaluna_luna_carmesi',
  'urshifu-rapid-strike': 'urshifu_fluido',
  'urshifu-single-strike': 'urshifu_brusco',
  'wishiwashi-school': 'wishiwashi_banco',
  'wishiwashi-solo': 'wishiwashi_individual',
  'wormadam-plant': 'wormadam_planta',
  'wormadam-sandy': 'wormadam_arena',
  'wormadam-trash': 'wormadam_basura',
  'zacian-crowned': 'zacian_espada_suprema',
  'zamazenta-crowned': 'zamazenta_escudo_supremo',
  'zarude-dada': 'zarude_papa',
  'zygarde-10': 'zygarde_diez',
  'zygarde-10-power-construct': 'zygarde_diez',
  'zygarde-50': 'zygarde',
  'zygarde-50-power-construct': 'zygarde',
  'zygarde-complete': 'zygarde_completo',
  'rotom-fan': 'rotom_ventilador',
  'rotom-frost': 'rotom_frio',
  'rotom-heat': 'rotom_calor',
  'rotom-mow': 'rotom_corte',
  'rotom-wash': 'rotom_lavado',

  // Megas/Mega-Z de fantasía que no existen oficialmente y no tienen animación en el
  // pack (ni "mega_x" ni "x_z") — se deja caer al icono estático, igual que con los
  // Pokémon Paradoja: no hay asset real que mostrar, no es un bug de mapeo.
}

// Alcremie es un caso aparte: sus 63 combinaciones sabor×decoración NO son
// `species.varieties` (pokemon.name) distintas como el resto de formas de este
// fichero — son sub-formas cosméticas (`pokemon-form`) de un único `pokemon` (id
// 869), así que PokemonFichaAssembler no las resuelve (ver esa clase) y no tienen
// slug corto propio. El selector de decoración (PokemonFichaPage) las referencia
// directamente por su `pokemon.forms[].name` (ej. "alcremie-ruby-swirl-love-sweet"),
// así que se registran aquí igual que cualquier otro nombre de API. Cruce sabor/forma
// en español -> nombre de fichero comprobado con David y verificado a ojo (color medio
// de cada .webp vs. el sabor real: crema_de_te = verde-amarillento = matcha,
// crema_de_menta = verde-azulado = menta, etc.) porque PokeAPI no da nombres en
// español para estas sub-formas.
const ALCREMIE_FLAVOR_ES = {
  'vanilla-cream': 'crema_de_vainilla',
  'ruby-cream': 'crema_rosa',
  'matcha-cream': 'crema_de_te',
  'mint-cream': 'crema_de_menta',
  'lemon-cream': 'crema_de_limon',
  'salted-cream': 'crema_salada',
  'ruby-swirl': 'mezcla_rosa',
  'caramel-swirl': 'mezcla_caramelo',
  'rainbow-swirl': 'tres_sabores',
}
const ALCREMIE_SWEET_ES = {
  'strawberry-sweet': null, // forma base, sin sufijo en el nombre de fichero
  'berry-sweet': 'fruto',
  'love-sweet': 'corazon',
  'star-sweet': 'estrella',
  'clover-sweet': 'trebol',
  'flower-sweet': 'flor',
  'ribbon-sweet': 'lazo',
}
for (const [flavorSlug, flavorEs] of Object.entries(ALCREMIE_FLAVOR_ES)) {
  for (const [sweetSlug, sweetEs] of Object.entries(ALCREMIE_SWEET_ES)) {
    NAME_OVERRIDES[`alcremie-${flavorSlug}-${sweetSlug}`] = sweetEs ? `alcremie_${flavorEs}_${sweetEs}` : `alcremie_${flavorEs}`
  }
}
// Único caso real (vainilla + fresa, la decoración por defecto): es literalmente
// "alcremie", no "alcremie_crema_de_vainilla" — pisa el valor que puso el bucle.
NAME_OVERRIDES['alcremie-vanilla-cream-strawberry-sweet'] = 'alcremie'

// Resto de especies con el mismo patrón que Alcremie/Unown (varias `pokemon.forms`
// cosméticas colgando de un único `pokemon`, sin `species.varieties` propia — auditado
// contra los 1351 `pokemon` cacheados: `JSON_LENGTH(payload->'$.forms') > 1`).
// Verificado igual que Alcremie: cruce con los ficheros reales de public/animated/.
const TYPE_ES = {
  normal: 'normal',
  fighting: 'lucha',
  flying: 'volador',
  poison: 'veneno',
  ground: 'tierra',
  rock: 'roca',
  bug: 'bicho',
  ghost: 'fantasma',
  steel: 'acero',
  fire: 'fuego',
  water: 'agua',
  grass: 'planta',
  electric: 'electrico',
  psychic: 'psiquico',
  ice: 'hielo',
  dragon: 'dragon',
  dark: 'siniestro',
  fairy: 'hada',
}
// Arceus (18 placas + "unknown", sin asset para "unknown") y Silvally (18 memorias):
// mismos sufijos de tipo en español, ver TYPE_NAMES_ES en pokemonTypes.js (aquí en
// minúsculas y sin tilde para que coincida con el nombre de fichero).
for (const [typeSlug, typeEs] of Object.entries(TYPE_ES)) {
  NAME_OVERRIDES[`arceus-${typeSlug}`] = `arceus_${typeEs}`
  NAME_OVERRIDES[`silvally-${typeSlug}`] = `silvally_${typeEs}`
}
// La forma normal de cada uno es el fichero base, no "arceus_normal"/"silvally_normal".
NAME_OVERRIDES['arceus-normal'] = 'arceus'
NAME_OVERRIDES['silvally-normal'] = 'silvally'

// Vivillon (20 patrones regionales, "floral" es el patrón por defecto/Meadow — mismo
// override que ya existía para 'vivillon' a secas). polar/tundra/continental no hacen
// falta aquí: el switch por defecto de abajo ya los resuelve bien. Los 5 últimos
// (elegant/garden/high-plains/sandstorm/river) son la asociación patrón→fichero menos
// segura de todo este bloque — no hay nombre oficial en español que contrastar, así
// que se identificaron mirando el frame real de cada .webp contra el diseño oficial de
// cada patrón (visto en pokemondb/bulbapedia), no solo por color.
const VIVILLON_PATTERN_ES = {
  meadow: 'floral',
  'icy-snow': 'taiga',
  garden: 'vergel',
  elegant: 'oriental',
  modern: 'moderno',
  marine: 'marino',
  archipelago: 'isleno',
  'high-plains': 'pantano',
  sandstorm: 'desierto',
  river: 'oasis',
  monsoon: 'monzon',
  savanna: 'estepa',
  sun: 'solar',
  ocean: 'oceano',
  jungle: 'jungla',
  fancy: 'fantasia',
  'poke-ball': 'poke_ball',
}
for (const [patternSlug, patternEs] of Object.entries(VIVILLON_PATTERN_ES)) {
  NAME_OVERRIDES[`vivillon-${patternSlug}`] = `vivillon_${patternEs}`
}

// Furfrou (10 cortes de pelo; "natural" es el fichero base, "kabuki" ya lo resuelve el
// switch por defecto sin ayuda).
const FURFROU_TRIM_ES = {
  heart: 'corazon',
  star: 'estrella',
  diamond: 'rombo',
  pharaoh: 'faraonico',
  debutante: 'senorita',
  dandy: 'caballero',
  matron: 'dama',
  'la-reine': 'aristocratico',
}
for (const [trimSlug, trimEs] of Object.entries(FURFROU_TRIM_ES)) {
  NAME_OVERRIDES[`furfrou-${trimSlug}`] = `furfrou_${trimEs}`
}
NAME_OVERRIDES['furfrou-natural'] = 'furfrou'

// Genesect (4 drives + forma base, que ya resuelve el switch por defecto).
const GENESECT_DRIVE_ES = {
  shock: 'fulgorom',
  burn: 'pirorom',
  chill: 'criorom',
  douse: 'hidrorom',
}
for (const [driveSlug, driveEs] of Object.entries(GENESECT_DRIVE_ES)) {
  NAME_OVERRIDES[`genesect-${driveSlug}`] = `genesect_${driveEs}`
}

// Flabébé/Floette/Florges (5 colores de flor cada una — floette-eternal ya estaba
// cubierto aparte, es una forma real distinta, no un color).
const FLOWER_COLOR_ES = {
  red: 'roja',
  yellow: 'amarilla',
  orange: 'naranja',
  blue: 'azul',
  white: 'blanca',
}
for (const [colorSlug, colorEs] of Object.entries(FLOWER_COLOR_ES)) {
  NAME_OVERRIDES[`flabebe-${colorSlug}`] = `flabebe_${colorEs}`
  NAME_OVERRIDES[`floette-${colorSlug}`] = `floette_${colorEs}`
  NAME_OVERRIDES[`florges-${colorSlug}`] = `florges_${colorEs}`
}

// Deerling/Sawsbuck (4 estaciones).
const SEASON_ES = {
  spring: 'primavera',
  summer: 'verano',
  autumn: 'otono',
  winter: 'invierno',
}
for (const [seasonSlug, seasonEs] of Object.entries(SEASON_ES)) {
  NAME_OVERRIDES[`deerling-${seasonSlug}`] = `deerling_${seasonEs}`
  NAME_OVERRIDES[`sawsbuck-${seasonSlug}`] = `sawsbuck_${seasonEs}`
}

// Cherrim (encapotado/soleado), Shellos/Gastrodon (mar este/oeste), Burmy (3 mantos —
// Mothim no hereda sprite propio por manto en el pack, solo tiene base+shiny).
NAME_OVERRIDES['cherrim-overcast'] = 'cherrim_encapotado'
NAME_OVERRIDES['cherrim-sunshine'] = 'cherrim_soleado'
NAME_OVERRIDES['shellos-west'] = 'shellos_oeste'
NAME_OVERRIDES['shellos-east'] = 'shellos_este'
NAME_OVERRIDES['gastrodon-west'] = 'gastrodon_oeste'
NAME_OVERRIDES['gastrodon-east'] = 'gastrodon_este'
NAME_OVERRIDES['burmy-plant'] = 'burmy_planta'
NAME_OVERRIDES['burmy-sandy'] = 'burmy_arena'
NAME_OVERRIDES['burmy-trash'] = 'burmy_basura'

export function animatedSpriteResourceName(pokemonApiName) {
  const override = NAME_OVERRIDES[pokemonApiName]
  if (override) return override

  const lower = pokemonApiName.toLowerCase()
  if (!lower.includes('-')) return lower

  const partes = lower.split('-')

  if (partes.length === 2 && partes[1] === 'mega') return `mega_${partes[0]}`
  if (partes.length === 3 && partes[1] === 'mega') return `mega_${partes[0]}_${partes[2]}`

  switch (partes[1]) {
    case 'alola':
      return `${partes[0]}_de_alola`
    case 'galar':
      return `${partes[0]}_de_galar`
    case 'hisui':
      return `${partes[0]}_de_hisui`
    case 'paldea':
      if (partes[0] === 'tauros') {
        if (partes[2] === 'blaze') return `${partes[0]}_de_paldea_ardiente`
        if (partes[2] === 'aqua') return `${partes[0]}_de_paldea_acuatica`
        if (partes[2] === 'combat') return `${partes[0]}_de_paldea_combatiente`
      }
      return `${partes[0]}_de_paldea`
    case 'f':
      return `${partes[0]}_hembra`
    case 'm':
      return `${partes[0]}_macho`
    case 'shield':
      return `${partes[0]}_escudo`
    case 'z':
      return `${partes[0]}_z`
    default:
      return `${partes[0]}_${partes[1]}`
  }
}

export function animatedSpriteUrl(pokemonApiName) {
  // Las formas Gigamax no tienen sprite propio en NAME_OVERRIDES (cae al de la forma
  // base, ej. 'charizard-gmax' -> 'charizard') porque ese mapeo se pensó para el pack
  // .webp normal — el aspecto Gigamax real vive aparte, en .gif descargados de Wikidex
  // con scripts/dinamax_live_sprites/scrap_gifs_gigamax.py y copiados a mano a
  // public/animated/{resourceName}_gigamax.gif (sin más variantes: no hay versión
  // hembra ni shiny en el material de origen).
  if (pokemonApiName.endsWith('-gmax')) {
    return `/animated/${animatedSpriteResourceName(pokemonApiName)}_gigamax.gif`
  }
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}.webp`
}

// Variante hembra del sprite BASE (especies con dimorfismo visual pero sin ser una
// variedad aparte en PokeAPI, ej. Meowstic/Pyroar/Frillish — no confundir con
// 'pikachu-f', que ya es su propia variedad y cae en el caso 'f' de arriba). Solo
// existe para un subconjunto de especies en el pack; quien la use debe comprobar que
// el archivo carga (ver useFemaleSpriteAvailable) antes de ofrecer el toggle.
export function femaleAnimatedSpriteUrl(pokemonApiName) {
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}_hembra.webp`
}

// Variantes shiny — el pack (re-exportado a .webp) ahora sí las incluye, con el mismo
// sufijo _shiny que ya usaba la app Android de referencia. Igual que con _hembra, no
// hay forma de saber de antemano qué especies lo tienen sin comprobar el archivo.
export function shinyAnimatedSpriteUrl(pokemonApiName) {
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}_shiny.webp`
}

export function femaleShinyAnimatedSpriteUrl(pokemonApiName) {
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}_hembra_shiny.webp`
}
