import { localizedEntry } from './pokeApiLocalization.js'

// Secciones que ya se pueden componer con lo que devuelve el ensamblador de ficha del
// backend (PokemonFichaAssembler). Faltan Tipos/Ubicaciones/Sprites del diseño de
// referencia (ver captura de Dexter, 2026-08-16): necesitan cruzar con recursos que el
// ensamblador todavía no resuelve (`type`, encounters) o carecen de asset propio
// (carátulas de juego) — no se inventan aquí.
// Catálogo interno indexado por `key`, no prosa de interfaz — etiquetas bilingües
// inline en vez de locales/*.json, mismo criterio que damageClassName.
export const FICHA_SECTIONS = [
  { key: 'DESC', label: { es: 'Descripción', en: 'Description' }, missingKey: 'species' },
  { key: 'EVOS', label: { es: 'Evolución', en: 'Evolution' }, missingKey: 'evolutionChain' },
  { key: 'STATS', label: { es: 'Stats', en: 'Stats' }, missingKey: null },
  { key: 'ABILITY', label: { es: 'Habilidades', en: 'Abilities' }, missingKey: 'abilities' },
  { key: 'MOVES', label: { es: 'Movimientos', en: 'Moves' }, missingKey: 'moves' },
  { key: 'INFO', label: { es: 'Info', en: 'Info' }, missingKey: 'species' },
  { key: 'FORM', label: { es: 'Formas', en: 'Forms' }, missingKey: 'forms' },
]

export function sectionMissingCount(missing, missingKey) {
  if (missingKey === null || !missing) return 0
  const value = missing[missingKey]
  return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

export function totalMissing(missing) {
  if (!missing) return 0
  const uniqueKeys = new Set(FICHA_SECTIONS.map(({ missingKey }) => missingKey).filter(Boolean))
  return Array.from(uniqueKeys).reduce((sum, key) => sum + sectionMissingCount(missing, key), 0)
}

export function genusForLanguage(species, language) {
  return localizedEntry(species?.genera, language, 'genus')
}

// Nombre de la propia especie en el idioma pedido (ver LanguageContext) — `pokemon.name`
// es siempre el slug en inglés, `species.names` trae la traducción real de PokeAPI.
export function speciesDisplayName(species, language, fallback) {
  return localizedEntry(species?.names, language, 'name') ?? fallback
}

// Todas las descripciones disponibles, una por versión de juego — sin colapsar ni
// agrupar versiones con texto idéntico entre sí (Rojo/Azul, Diamante/Perla/Platino...
// realmente compartían la misma redacción en los juegos, ver
// .claude/memory/project_pokewebmax_progress.md) — cada versión real es su propia
// entrada del selector, punto. PokeAPI tiene mucho menos texto traducido a idiomas
// distintos del inglés en juegos antiguos (verificado: Bulbasaur tiene 28 entradas en
// inglés —de Rojo a Escudo— pero solo 8 en español, empezando en X/Y) — así que el
// fallback a inglés es POR VERSIÓN, no global: si el idioma pedido no cubre un juego,
// se usa el inglés solo para ese juego en concreto (marcado con `translated: false`)
// en vez de que el juego entero desaparezca del selector.
//
// `wikidexFlavorText` (viene de la ficha del backend, ver PokemonFichaAssembler) es un
// tercer nivel de fallback SOLO para español, importado offline del dump de WikiDex:
// PokeAPI-ES -> WikiDex-ES -> PokeAPI-EN. Se cuenta como `translated: true` porque
// realmente es texto en español, solo que de otra fuente — no lleva el tag "EN".
export function flavorTextsByVersion(species, language, wikidexFlavorText = {}) {
  const textByVersion = new Map() // version -> { es?: string, en?: string }
  for (const entry of species?.flavor_text_entries ?? []) {
    const lang = entry.language.name
    if (lang !== language && lang !== 'en') continue

    const version = entry.version.name
    const text = entry.flavor_text.replace(/[\n\f]/g, ' ')
    if (!textByVersion.has(version)) textByVersion.set(version, {})
    textByVersion.get(version)[lang] = text
  }
  // WikiDex puede cubrir un juego para el que PokeAPI no tiene NINGUNA entrada propia
  // (ni siquiera en inglés) — bug real encontrado 2026-08-24 con Golbat/Legends Z-A:
  // ese juego ni aparecía en `species.flavor_text_entries`, así que el bucle de abajo
  // nunca llegaba a consultar el fallback de WikiDex para él. Se asegura una entrada
  // vacía para cada versión que solo tiene WikiDex, para que sí entre en el bucle.
  for (const version of Object.keys(wikidexFlavorText)) {
    if (!textByVersion.has(version)) textByVersion.set(version, {})
  }

  const result = []
  for (const [version, texts] of textByVersion) {
    let translated = texts[language] !== undefined
    let text = translated ? texts[language] : texts.en
    if (!translated && language === 'es' && wikidexFlavorText[version] !== undefined) {
      text = wikidexFlavorText[version]
      translated = true
    }
    if (text === undefined) continue
    result.push({ version, text, translated })
  }

  return result
}

// Descripción de una habilidad o movimiento a partir de su `flavor_text_entries`
// (mismo formato que species, pero SIN el nivel de detalle "por versión" — aquí solo
// hace falta un texto representativo). Se usa flavor_text_entries y no
// effect_entries porque effect_entries no tiene NINGUNA entrada en español en toda la
// caché de este proyecto (0/373 abilities, 0/937 moves — limitación real de PokeAPI,
// verificado con SQL directo), mientras que flavor_text_entries sí trae español para
// la mayoría (267/373 abilities, 826/937 moves) con el mismo texto corto.
// Se queda con la ÚLTIMA entrada que matchea en vez de la primera: el array viene en
// orden cronológico ascendente por version_group y el texto cambia de redacción entre
// generaciones — la última es la más moderna.
//
// `wikidexText` (viene de ficha.wikidexEffectText.{ability,move}, ver
// PokemonFichaAssembler) es el tercer nivel de fallback para lo que ni siquiera
// PokeAPI trae en español — el "== Efecto ==" de la página de WikiDex de esa
// habilidad/movimiento, importado offline (ver
// .claude/memory/project_pokewebmax_progress.md, "paridad total"). Mismo criterio que
// wikidexFlavorText en flavorTextsByVersion: cuenta como `translated: true` porque
// realmente es texto en español, solo que de otra fuente.
export function latestVersionedText(entries, language, textKey = 'flavor_text', wikidexText = null) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return wikidexText && language === 'es'
      ? { text: wikidexText, translated: true }
      : { text: null, translated: false }
  }

  let matched
  let fallbackEn
  for (const entry of entries) {
    const lang = entry.language.name
    if (lang === language) matched = entry[textKey]
    else if (lang === 'en') fallbackEn = entry[textKey]
  }

  let translated = matched !== undefined
  let raw = translated ? matched : fallbackEn
  if (!translated && language === 'es' && wikidexText) {
    raw = wikidexText
    translated = true
  }
  return { text: raw?.replace(/[\n\f]/g, ' ') ?? null, translated }
}

// physical/special/status: solo 3 valores fijos de PokeAPI, seguro hardcodear en vez
// de depender de cachear el recurso move-damage-class solo para esto.
const DAMAGE_CLASS_ES = { physical: 'Físico', special: 'Especial', status: 'Estado' }

export function damageClassName(slug, language) {
  if (language === 'es') return DAMAGE_CLASS_ES[slug] ?? slug
  return slug.length > 0 ? slug[0].toUpperCase() + slug.slice(1) : slug
}

// level-up/machine/tutor/egg: los 4 métodos de aprendizaje que de verdad aparecen en
// los datos de este proyecto (comprobado con SQL) — sin icono propio en el pack
// descargado de WikiDex (a diferencia de físico/especial/estado), así que se muestra
// como etiqueta de texto corta, mismo criterio que ya usaba
// `determineLearnIndicatorText`/`formatMoveLearnMethod` en el proyecto Android de
// referencia (Movimientos.kt): "Nivel" lleva además el número al lado en el JSX, no
// aquí — esta función solo da el nombre del método.
const LEARN_METHOD_ES = { 'level-up': 'Nivel', machine: 'MT/MO', tutor: 'Tutor', egg: 'Cría' }
const LEARN_METHOD_EN = { 'level-up': 'Level', machine: 'TM/HM', tutor: 'Tutor', egg: 'Egg' }

export function moveLearnMethodName(method, language) {
  if (!method) return '—'
  if (language === 'es') return LEARN_METHOD_ES[method] ?? method
  return LEARN_METHOD_EN[method] ?? method
}

// Iconos copiados de Pokedex_API (proyecto Android de referencia, solo lectura — ver
// CLAUDE.md), no generados aquí. Estáticos porque solo hay 3 valores posibles.
const DAMAGE_CLASS_ICONS = {
  physical: new URL('../assets/damage-classes/physical.png', import.meta.url).href,
  special: new URL('../assets/damage-classes/special.png', import.meta.url).href,
  status: new URL('../assets/damage-classes/status.png', import.meta.url).href,
}

export function damageClassIconUrl(slug) {
  return DAMAGE_CLASS_ICONS[slug] ?? null
}

const ROMAN_GENERATIONS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

// Reusado tanto para `species.generation` como para el `generation` que cuelga de
// cada entrada de past_types/past_abilities/past_stats (mismo formato "generation-x"
// en los tres sitios).
export function romanGenerationNumber(generationRef) {
  const roman = generationRef?.name?.split('-')[1]
  return roman ? (ROMAN_GENERATIONS[roman] ?? null) : null
}

export function generationNumber(species) {
  return romanGenerationNumber(species?.generation)
}

function idFromUrl(url) {
  const segments = url.split('/').filter(Boolean)
  return Number(segments[segments.length - 1])
}

// Prioridad para decidir CUÁL de los métodos de aprendizaje mostrar cuando un
// movimiento tiene varios entre distintos juegos (ej. Placaje se aprende por nivel en
// unos y ya lo trae de fábrica en otros) — mismo criterio y mismo orden que
// `determineLearnIndicatorText` en el proyecto Android de referencia
// (Movimientos.kt): nivel primero, luego MT/MO, tutor, cría. `null` no es un método
// real de PokeAPI (algunos recursos tienen huecos raros, ej. formas Paradoja/Totem
// sin movimientos MT registrados) y se descarta al elegir prioridad.
const LEARN_METHOD_PRIORITY = ['level-up', 'machine', 'tutor', 'egg']

// Método por el que se aprende un movimiento (y el nivel, si aplica), a partir de
// `pokemon.moves` (ya viene completo en la ficha — el payload de `pokemon` no se
// recorta, no hace falta tocar el backend para esto). El mismo movimiento puede
// aparecer con métodos y niveles distintos entre generaciones (ver Bulbasaur:
// 'tackle' es nivel 1 en rojo/azul).
//
// Con `versionGroup` (juego elegido en el selector de la ficha, ver
// PokemonFichaPage), se restringe a las entradas de ESE juego en concreto — método y
// nivel tal cual eran ahí. Sin `versionGroup` (nada elegido, comportamiento por
// defecto sin cambios respecto a antes de este selector): para el nivel se usa el
// version_group con el id más alto (el más reciente, los ids de PokeAPI son
// cronológicos) como "el nivel actual"; para el MÉTODO se usa la prioridad de arriba
// sobre todos los juegos en los que aparece, no solo el más reciente — un movimiento
// que en algún juego se aprendía por nivel sigue clasificándose como "Nivel", aunque
// en la versión más reciente ya no sea así.
export function moveLearnMethod(pokemonMoves, moveName, versionGroup = null) {
  const entry = pokemonMoves?.find((m) => m.move.name === moveName)
  if (!entry) return { method: null, level: null }

  const details = versionGroup
    ? entry.version_group_details.filter((vgd) => vgd.version_group.name === versionGroup)
    : entry.version_group_details
  if (details.length === 0) return { method: null, level: null }

  const methodsPresent = new Set(details.map((vgd) => vgd.move_learn_method.name))
  const method = LEARN_METHOD_PRIORITY.find((m) => methodsPresent.has(m)) ?? details[0]?.move_learn_method.name ?? null

  if (method !== 'level-up') return { method, level: null }

  let best = null
  for (const vgd of details) {
    if (vgd.move_learn_method.name !== 'level-up') continue
    const versionGroupId = idFromUrl(vgd.version_group.url)
    if (best === null || versionGroupId > best.versionGroupId) {
      best = { versionGroupId, level: vgd.level_learned_at }
    }
  }
  return { method, level: best?.level ?? null }
}

// Filtra `ficha.moves` a los que de verdad se puedan aprender en `versionGroup` — un
// movimiento sin ninguna entrada de version_group_details para ese juego no tiene
// sentido en la tabla (mismo criterio de "ámbito Juego" que resolvePokedexNames en
// usePokemonBrowser.js, aquí aplicado a la ficha en vez de a la lista). Sin
// `versionGroup`, se devuelve la lista tal cual (comportamiento por defecto).
export function movesForVersionGroup(moves, pokemonMoves, versionGroup) {
  if (!versionGroup) return moves
  return moves.filter((m) => {
    const entry = pokemonMoves?.find((pm) => pm.move.name === m.name)
    return entry?.version_group_details.some((vgd) => vgd.version_group.name === versionGroup) ?? false
  })
}

// `t` es el i18next `t()` de react-i18next (ver PokemonFichaPage.jsx) — prosa de
// interfaz con interpolación (nivel, ítem...), no un catálogo estático, así que va por
// locales/*.json y no inline como FICHA_SECTIONS/DAMAGE_CLASS_ES.
//
// `itemNames`/`language` localizan el nombre del objeto interpolado, mismo mapa que
// usePokemonNames pero para objetos (ver useItemNames) — el objeto crudo de PokeAPI
// solo trae `{name, url}`, sin `names`, así que hay que cruzarlo por id igual que se
// hace con las especies de la propia cadena evolutiva.
//
// Devuelve `{ text, item }` en vez de solo el texto — `item` es el `{name, url}` crudo
// de PokeAPI cuando la evolución depende de un objeto (piedra, objeto que se lleva
// puesto...), para que el JSX pueda pintar su icono/enlace además de la frase (ver
// itemIconUrl en itemSprite.js). `null` si el método no involucra ningún objeto.
//
// `versionGroup` (juego elegido en la ficha): si se da, se prioriza la entrada de
// `details` de ESE juego (un mismo paso evolutivo puede tener un método distinto
// entre juegos, ej. objeto que se lleva puesto en vez de trueque en los remakes) —
// antes esto no se miraba y se cogía siempre `details[0]` sin más, aunque no fuera el
// juego elegido; se mantiene `details[0]` como fallback si ese juego en concreto no
// tiene una entrada propia (ninguna entrada le aplica: chain incompleta) o si no hay
// `versionGroup` (comportamiento por defecto sin cambios).
function evolutionMethodLabel(details, t, itemNames, language, versionGroup = null) {
  const d = (versionGroup && details?.find((entry) => entry.version_group.name === versionGroup)) || details?.[0]
  if (!d) return null
  if (d.min_level) return { text: t('ficha.evoMethod.level', { level: d.min_level }), item: null }
  if (d.item) {
    const itemId = idFromUrl(d.item.url)
    const localized = itemNames?.[itemId]?.[language]
    const itemLabel = localized ?? d.item.name.replace(/-/g, ' ')
    return { text: t('ficha.evoMethod.useItem', { item: itemLabel }), item: d.item }
  }
  if (d.min_happiness) return { text: t('ficha.evoMethod.happiness', { value: d.min_happiness }), item: null }
  if (d.trigger?.name === 'trade') return { text: t('ficha.evoMethod.trade'), item: null }
  return { text: t('ficha.evoMethod.default'), item: null }
}

// Aplana la cadena evolutiva (estructura recursiva chain.evolves_to[]) a una lista
// ordenada de etapas con el método de la transición ANTERIOR a cada una (ver
// evolutionMethodLabel) — ignora ramas alternativas (ej. Eevee), suficiente para una
// vista lineal simple.
export function evolutionStages(evolutionChain, t, itemNames, language, versionGroup = null) {
  const stages = []
  let node = evolutionChain?.chain
  let method = null
  while (node) {
    stages.push({ id: idFromUrl(node.species.url), name: node.species.name, method })
    method = evolutionMethodLabel(node.evolves_to?.[0]?.evolution_details, t, itemNames, language, versionGroup)
    node = node.evolves_to?.[0]
  }
  return stages
}

// Tipo(s) del Pokémon "tal cual eran" en `generation` — `pokemon.past_types` es un
// REEMPLAZO COMPLETO del array de tipos válido hasta esa generación inclusive (a
// diferencia de past_abilities/past_stats, ver resolvePastBySlot más abajo — se
// verificó con datos reales: Clefairy tiene una única entrada past_types con
// generation-v y types:[normal], y pasa a Hada (`pokemon.types`) desde la generación
// VI). Se recorre ascendente por generación y se coge la primera entrada cuya
// generación sea >= la pedida; si ninguna aplica (se pidió una generación posterior
// al último cambio, o no hay `past_types` en absoluto), se usa `pokemon.types` tal
// cual. Sin `generation` (nada elegido en el selector), se devuelve `pokemon.types`
// sin más — mismo comportamiento que antes de este selector.
export function resolvePastTypes(pokemon, generation = null) {
  if (generation == null) return pokemon.types
  const candidates = (pokemon.past_types ?? [])
    .map((entry) => ({ generation: romanGenerationNumber(entry.generation), types: entry.types }))
    .filter((entry) => entry.generation != null && entry.generation >= generation)
    .sort((a, b) => a.generation - b.generation)
  return candidates[0]?.types ?? pokemon.types
}

// past_abilities/past_stats son OVERRIDES PARCIALES, no un reemplazo completo como
// past_types: cada entrada solo lista los slots/stats que de verdad cambiaban en esa
// generación (verificado: la entrada generation-iii de past_abilities de Clefairy
// solo trae el slot 2, no los 3 — porque el slot 1 nunca cambió). Por eso se resuelve
// slot a slot: para cada elemento de `currentArray`, se busca (ascendente por
// generación) la primera entrada de `pastEntries` con generación >= la pedida que
// mencione ESE slot; si la hay, se usa su valor (que puede venir como `null` —
// significa que ese slot no existía todavía en esa generación); si no hay ninguna
// entrada que lo mencione, se mantiene el valor actual.
//
// `slotKey` identifica qué campo hace de "clave de slot" dentro de cada elemento
// (`'slot'` para abilities, `'stat.name'` para stats — dotted porque el nombre vive
// dentro de `stat.name`, no en el nivel superior). Nota para stats: en la entrada de
// generation-i el nombre es `'special'` (el stat combinado pre-split de Ataque/Defensa
// Especial), no una de las etiquetas modernas — se trata como una etiqueta más, sin
// intentar mapearla 1:1.
function readSlotKey(item, slotKey) {
  return slotKey.split('.').reduce((value, key) => value?.[key], item)
}

export function resolvePastBySlot(pastEntries, currentArray, generation, slotKey) {
  if (generation == null) return currentArray
  const sorted = (pastEntries ?? [])
    .map((entry) => ({ generation: romanGenerationNumber(entry.generation), items: entry }))
    .filter((entry) => entry.generation != null && entry.generation >= generation)
    .sort((a, b) => a.generation - b.generation)

  return currentArray.map((current) => {
    const slotValue = readSlotKey(current, slotKey)
    for (const { items } of sorted) {
      const list = items.abilities ?? items.stats ?? []
      const match = list.find((item) => readSlotKey(item, slotKey) === slotValue)
      if (match) return match
    }
    return current
  })
}

export const LEGACY_STAT_ORDER = ['hp', 'attack', 'defense', 'special', 'speed']
export const LEGACY_STAT_LABELS = { hp: 'HP', attack: 'ATK', defense: 'DEF', special: 'SPECIAL', speed: 'SPD' }

// Stats "tal cual eran" en `generation`, para STATS de la ficha. A diferencia de
// tipos/habilidades, aquí el propio ESQUEMA cambia en la generación I: antes del
// split de la generación II solo existía un stat "Special" combinado en vez de
// Ataque/Defensa Especial por separado (`pokemon.past_stats` lo confirma: la entrada
// generation-i de Clefairy trae un único stat llamado 'special', no seis) — por eso
// esta función no devuelve solo valores nuevos sobre el mismo array de 6, sino
// también un `order` de 5 nombres distinto para generación I. Para generación >= 2 se
// reusa el override genérico por slot (resolvePastBySlot) sobre el array moderno de 6
// sin más — ahí el esquema no cambia, solo pueden cambiar valores puntuales (ej.
// retoques de equilibrio en juegos posteriores). Sin `generation`, se devuelve
// `pokemon.stats` con el orden moderno de siempre (`order: null`, el caller usa
// STAT_ORDER por defecto) — comportamiento idéntico al de antes de este selector.
export function resolveHistoricalStats(pokemon, generation = null) {
  if (generation == null) return { order: null, stats: pokemon.stats }

  const modern = resolvePastBySlot(pokemon.past_stats, pokemon.stats, generation, 'stat.name')
  if (generation >= 2) return { order: null, stats: modern }

  const byName = Object.fromEntries(modern.map((s) => [s.stat.name, s.base_stat]))
  const sortedPast = (pokemon.past_stats ?? [])
    .map((entry) => ({ generation: romanGenerationNumber(entry.generation), stats: entry.stats }))
    .filter((entry) => entry.generation != null && entry.generation >= 1)
    .sort((a, b) => a.generation - b.generation)
  const specialEntry = sortedPast.map((entry) => entry.stats.find((s) => s.stat.name === 'special')).find(Boolean)
  // Sin entrada 'special' explícita: Ataque/Defensa Especial ya valen lo mismo hoy
  // (PokeAPI solo registra past_stats cuando hace falta desambiguar), así que
  // cualquiera de los dos sirve como el "Special" original.
  const specialValue = specialEntry?.base_stat ?? byName['special-attack']

  return {
    order: LEGACY_STAT_ORDER,
    stats: [
      { stat: { name: 'hp' }, base_stat: byName.hp },
      { stat: { name: 'attack' }, base_stat: byName.attack },
      { stat: { name: 'defense' }, base_stat: byName.defense },
      { stat: { name: 'special' }, base_stat: specialValue },
      { stat: { name: 'speed' }, base_stat: byName.speed },
    ],
  }
}
