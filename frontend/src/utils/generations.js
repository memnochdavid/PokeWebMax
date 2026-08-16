const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX' }

// Nombre de región en español, para acompañar el número romano en el paginador —
// mismo criterio de localización que el resto de la app (ej. "Teselia" y no "Unova").
const REGION = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Teselia',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
}

export function generationRoman(id) {
  return ROMAN[id] ?? `#${id}`
}

export function generationRegion(id) {
  return REGION[id] ?? null
}
