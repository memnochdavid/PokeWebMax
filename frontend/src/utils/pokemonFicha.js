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

export function generationNumber(species) {
  const roman = species?.generation?.name?.split('-')[1]
  return roman ? (ROMAN_GENERATIONS[roman] ?? null) : null
}

function idFromUrl(url) {
  const segments = url.split('/').filter(Boolean)
  return Number(segments[segments.length - 1])
}

// Nivel en el que se aprende un movimiento por subida de nivel, a partir de
// `pokemon.moves` (ya viene completo en la ficha — el payload de `pokemon` no se
// recorta, no hace falta tocar el backend para esto). Un movimiento puede aparecer con
// method 'level-up' en varios version_group con niveles distintos entre generaciones
// (ver Bulbasaur: 'tackle' es nivel 1 en rojo/azul); se usa el version_group con el id
// más alto (el más reciente, los ids de PokeAPI son cronológicos) como "el nivel
// actual". null si el movimiento nunca se aprende por nivel (solo MT/cría/tutor) —
// se ordena al final de la tabla, no como si fuera nivel 0.
export function moveLevelLearned(pokemonMoves, moveName) {
  const entry = pokemonMoves?.find((m) => m.move.name === moveName)
  if (!entry) return null

  let best = null
  for (const vgd of entry.version_group_details) {
    if (vgd.move_learn_method.name !== 'level-up') continue
    const versionGroupId = idFromUrl(vgd.version_group.url)
    if (best === null || versionGroupId > best.versionGroupId) {
      best = { versionGroupId, level: vgd.level_learned_at }
    }
  }
  return best?.level ?? null
}

// `t` es el i18next `t()` de react-i18next (ver PokemonFichaPage.jsx) — prosa de
// interfaz con interpolación (nivel, ítem...), no un catálogo estático, así que va por
// locales/*.json y no inline como FICHA_SECTIONS/DAMAGE_CLASS_ES.
function evolutionMethodLabel(details, t) {
  const d = details?.[0]
  if (!d) return null
  if (d.min_level) return t('ficha.evoMethod.level', { level: d.min_level })
  if (d.item) return t('ficha.evoMethod.useItem', { item: d.item.name.replace(/-/g, ' ') })
  if (d.min_happiness) return t('ficha.evoMethod.happiness', { value: d.min_happiness })
  if (d.trigger?.name === 'trade') return t('ficha.evoMethod.trade')
  return t('ficha.evoMethod.default')
}

// Aplana la cadena evolutiva (estructura recursiva chain.evolves_to[]) a una lista
// ordenada de etapas con el método de la transición ANTERIOR a cada una — ignora ramas
// alternativas (ej. Eevee), suficiente para una vista lineal simple.
export function evolutionStages(evolutionChain, t) {
  const stages = []
  let node = evolutionChain?.chain
  let method = null
  while (node) {
    stages.push({ id: idFromUrl(node.species.url), name: node.species.name, method })
    method = evolutionMethodLabel(node.evolves_to?.[0]?.evolution_details, t)
    node = node.evolves_to?.[0]
  }
  return stages
}
