// Caché en memoria (fuera de React) del estado de navegación de la lista de
// Pokémon — filtros, orden, generación activa y ámbito de Pokédex regional/juego —
// mismo criterio que pokemonListCache.js (sobrevive a que PokemonListPage se
// desmonte al ir a una ficha y se remonte al volver; se pierde al recargar el
// navegador, no hace falta persistirlo más allá de eso). Sin esto, cada ida y
// vuelta a la lista reseteaba filtros/orden/Pokédex elegida a los valores por
// defecto — pedido explícito de David.
let stored = null

export function getStoredBrowserState() {
  return stored
}

export function setStoredBrowserState(state) {
  stored = state
}
