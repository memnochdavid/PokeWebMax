// Etiqueta + orden de las regiones para el select "Región" del modo Regional de la
// lista de Pokémon — mismos valores que utils/generations.js (indexado por nº de
// generación, no por slug de región) más 'hisui' añadido, que no tiene generación
// propia en ese diccionario. PokeAPI no trae nombre en español para el resourceType
// `region` (solo ja/ko/zh/fr/de/it/en, verificado) — de ahí que, igual que
// generations.js, esto se mantenga a mano en vez de leerlo del catálogo.
const REGION_LABEL = {
  kanto: { es: 'Kanto', en: 'Kanto' },
  johto: { es: 'Johto', en: 'Johto' },
  hoenn: { es: 'Hoenn', en: 'Hoenn' },
  sinnoh: { es: 'Sinnoh', en: 'Sinnoh' },
  unova: { es: 'Teselia', en: 'Unova' },
  kalos: { es: 'Kalos', en: 'Kalos' },
  alola: { es: 'Alola', en: 'Alola' },
  galar: { es: 'Galar', en: 'Galar' },
  hisui: { es: 'Hisui', en: 'Hisui' },
  paldea: { es: 'Paldea', en: 'Paldea' },
}

// Orden cronológico, mismo criterio que REGION en generations.js.
export const REGION_ORDER = Object.keys(REGION_LABEL)

export function regionLabel(slug, language = 'es') {
  return REGION_LABEL[slug]?.[language] ?? REGION_LABEL[slug]?.es ?? slug
}
