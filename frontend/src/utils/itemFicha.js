// Descripciones de un objeto por version_group (no por version individual como
// species/moves — PokeAPI agrupa el flavor_text_entries de item por version_group,
// ej. 'ruby-sapphire' cubre ambos juegos con el mismo texto) — mismo criterio de
// fallback a inglés que flavorTextsByVersion() en pokemonFicha.js.
export function itemFlavorTextsByVersionGroup(item, language) {
  const textByGroup = new Map() // version_group -> { es?: string, en?: string }
  for (const entry of item?.flavor_text_entries ?? []) {
    const lang = entry.language.name
    if (lang !== language && lang !== 'en') continue

    const group = entry.version_group.name
    const text = entry.text.replace(/[\n\f]/g, ' ')
    if (!textByGroup.has(group)) textByGroup.set(group, {})
    textByGroup.get(group)[lang] = text
  }

  const result = []
  for (const [versionGroup, texts] of textByGroup) {
    const translated = texts[language] !== undefined
    const text = translated ? texts[language] : texts.en
    if (text === undefined) continue
    result.push({ versionGroup, text, translated })
  }

  return result
}

// generation.url de cada game_indices ya viene resuelto por generación (no por juego
// individual) — basta con los números romanos -> arábigos, mismo mapa que
// generationNumber() en pokemonFicha.js.
const ROMAN_GENERATIONS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

export function itemGenerations(item) {
  const numbers = new Set()
  for (const entry of item?.game_indices ?? []) {
    const roman = entry.generation?.name?.split('-')[1]
    if (roman && ROMAN_GENERATIONS[roman]) numbers.add(ROMAN_GENERATIONS[roman])
  }
  return Array.from(numbers).sort((a, b) => a - b)
}
