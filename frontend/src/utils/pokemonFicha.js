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

// Todas las descripciones disponibles, una por versión de juego. PokeAPI tiene mucho
// menos texto traducido a idiomas distintos del inglés en juegos antiguos (verificado:
// Bulbasaur tiene 28 entradas en inglés —de Rojo a Escudo— pero solo 8 en español,
// empezando en X/Y) — así que el fallback a inglés es POR VERSIÓN, no global: si el
// idioma pedido no cubre un juego, se usa el inglés solo para ese juego en concreto
// (marcado con `translated: false`) en vez de que el juego entero desaparezca del
// selector. El texto duplicado entre versiones consecutivas se sigue colapsando en una
// sola entrada (varias ediciones suelen compartir la misma redacción) para no acabar
// con un selector de 20+ pastillas casi idénticas.
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

  const seen = new Map()
  for (const [version, texts] of textByVersion) {
    let translated = texts[language] !== undefined
    let text = translated ? texts[language] : texts.en
    if (!translated && language === 'es' && wikidexFlavorText[version] !== undefined) {
      text = wikidexFlavorText[version]
      translated = true
    }
    if (text === undefined) continue
    if (!seen.has(text)) {
      seen.set(text, { version, translated })
    }
  }

  return Array.from(seen, ([text, { version, translated }]) => ({ version, text, translated }))
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
export function latestVersionedText(entries, language, textKey = 'flavor_text') {
  if (!Array.isArray(entries) || entries.length === 0) return { text: null, translated: false }

  let matched
  let fallbackEn
  for (const entry of entries) {
    const lang = entry.language.name
    if (lang === language) matched = entry[textKey]
    else if (lang === 'en') fallbackEn = entry[textKey]
  }

  const translated = matched !== undefined
  const raw = translated ? matched : fallbackEn
  return { text: raw?.replace(/[\n\f]/g, ' ') ?? null, translated }
}

// physical/special/status: solo 3 valores fijos de PokeAPI, seguro hardcodear en vez
// de depender de cachear el recurso move-damage-class solo para esto.
const DAMAGE_CLASS_ES = { physical: 'Físico', special: 'Especial', status: 'Estado' }

export function damageClassName(slug, language) {
  if (language === 'es') return DAMAGE_CLASS_ES[slug] ?? slug
  return slug.length > 0 ? slug[0].toUpperCase() + slug.slice(1) : slug
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
