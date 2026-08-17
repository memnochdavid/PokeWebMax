// Caché en memoria para GET /api/items — mismo criterio que pokemonListCache.js
// (~2200 filas, evita repetir el fetch en cada ida y vuelta a la ficha de objeto).
let cachedItems = null

export function getCachedItems() {
  return cachedItems
}

export function setCachedItems(items) {
  cachedItems = items
}

export function invalidateItemsCache() {
  cachedItems = null
}
