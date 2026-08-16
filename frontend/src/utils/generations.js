const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX' }

// Nombre de región, para acompañar el número romano en el paginador — nombre oficial
// por idioma (ej. "Teselia" en español vs "Unova" en inglés), mismo criterio de
// localización de datos que el resto de la app (ver damageClassName en
// utils/pokemonFicha.js), no es prosa de interfaz.
const REGION = {
  1: { es: 'Kanto', en: 'Kanto' },
  2: { es: 'Johto', en: 'Johto' },
  3: { es: 'Hoenn', en: 'Hoenn' },
  4: { es: 'Sinnoh', en: 'Sinnoh' },
  5: { es: 'Teselia', en: 'Unova' },
  6: { es: 'Kalos', en: 'Kalos' },
  7: { es: 'Alola', en: 'Alola' },
  8: { es: 'Galar', en: 'Galar' },
  9: { es: 'Paldea', en: 'Paldea' },
}

export function generationRoman(id) {
  return ROMAN[id] ?? `#${id}`
}

export function generationRegion(id, language = 'es') {
  return REGION[id]?.[language] ?? REGION[id]?.es ?? null
}
