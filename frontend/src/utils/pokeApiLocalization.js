// Resuelve un texto localizado de un array PokeAPI con forma
// [{ <textKey>: '...', language: { name: 'es' } }, ...] (names, genera,
// flavor_text_entries...). Con fallback a inglés y luego al primero disponible, para
// no dejar nunca un hueco vacío si hay algún dato aunque falte justo el idioma pedido.
export function localizedEntry(entries, language, textKey = 'name') {
  if (!Array.isArray(entries) || entries.length === 0) return null

  return (
    entries.find((e) => e.language.name === language)?.[textKey] ??
    entries.find((e) => e.language.name === 'en')?.[textKey] ??
    entries[0][textKey] ??
    null
  )
}

// Igual que localizedEntry pero con un fallback explícito propio (típicamente el slug
// en inglés ya formateado) cuando el payload no tiene `names` en absoluto — caso de
// recursos cacheados con datos parciales o el resource_type nunca cachea `names`.
export function localizedName(payload, language, fallback) {
  return localizedEntry(payload?.names, language, 'name') ?? fallback
}
