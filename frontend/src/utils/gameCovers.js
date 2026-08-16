// Carátulas copiadas de Pokedex_API (proyecto Android de referencia, solo lectura —
// ver CLAUDE.md), no generadas aquí. Extensión mixta (webp/jpg/png según el archivo
// original), así que se resuelven con import.meta.glob en vez de imports estáticos
// uno a uno — el nombre de archivo (sin extensión) ES el version slug de PokeAPI.
const modules = import.meta.glob('../assets/games/*.{webp,jpg,png}', { eager: true, import: 'default' })

const coverBySlug = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.match(/([^/]+)\.\w+$/)[1], url]),
)

// null para versiones sin carátula en el set copiado (DLC/exclusivas de Japón que
// Pokedex_API no necesitaba, ej. colosseum, the-teal-mask-scarlet) — quien lo use
// debe caer de vuelta al nombre de texto en ese caso.
export function gameCoverUrl(versionSlug) {
  return coverBySlug[versionSlug] ?? null
}
