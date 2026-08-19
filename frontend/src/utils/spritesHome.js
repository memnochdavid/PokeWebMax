// Resuelve la ruta al sprite estilo HOME descargado localmente en
// public/sprites_home/gen{N}/{id}.png (carpeta gitignored, ver .gitignore — assets con
// copyright, David los descarga manualmente, no se suben al repo). Solo cubre la forma
// base (sin el sufijo _01/_02 de variantes) — quien la use debe tener fallback a otra
// fuente (ej. PokeAPI) para lo que no exista en disco.
const GEN_RANGES = [
  [1, 151, 1],
  [152, 251, 2],
  [252, 386, 3],
  [387, 493, 4],
  [494, 649, 5],
  [650, 721, 6],
  [722, 809, 7],
  [810, 905, 8],
  [906, 1025, 9],
]

export function spriteHomeUrl(id) {
  const range = GEN_RANGES.find(([min, max]) => id >= min && id <= max)
  if (!range) return null

  return `/sprites_home/gen${range[2]}/${String(id).padStart(4, '0')}.png`
}

// Fallback remoto cuando no hay sprite HOME local descargado — mismo pack "official
// artwork" de PokeAPI que ya se usaba como `sprite` en PokemonCard/PokemonTable.
export function officialArtworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
}
