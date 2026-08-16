// Caché en memoria (fuera de React, sobrevive a que PokemonListPage se desmonte al
// navegar a la ficha y se remonte al volver) para no repetir GET /api/pokemon en cada
// ida y vuelta — ~1300 filas, tarda perceptiblemente. Vive mientras dure la pestaña;
// se pierde al recargar el navegador (igual que el resto del estado de React, no hace
// falta persistirlo). `invalidate()` la limpia cuando se cachea algo nuevo desde
// /cache, para no dejar la lista desactualizada silenciosamente.
let cachedPokemon = null

export function getCachedPokemon() {
  return cachedPokemon
}

export function setCachedPokemon(pokemon) {
  cachedPokemon = pokemon
}

export function invalidatePokemonCache() {
  cachedPokemon = null
}
