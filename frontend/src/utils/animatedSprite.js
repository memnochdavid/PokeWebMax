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
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}.webm`
}

// Variante hembra del sprite BASE (especies con dimorfismo visual pero sin ser una
// variedad aparte en PokeAPI, ej. Meowstic/Pyroar/Frillish — no confundir con
// 'pikachu-f', que ya es su propia variedad y cae en el caso 'f' de arriba). Solo
// existe para un subconjunto de especies en el pack; quien la use debe comprobar que
// el archivo carga (ver useFemaleSpriteAvailable) antes de ofrecer el toggle.
export function femaleAnimatedSpriteUrl(pokemonApiName) {
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}_hembra.webm`
}
