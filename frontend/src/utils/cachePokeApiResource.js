import axios from 'axios'

// Tamaño de lote enviado a POST /cache-batch — el backend pide esos ids a PokeAPI en
// paralelo (ver PokeApiClient::fetchManyResources), así que esto no es "cuántos caben
// en una respuesta" sino "cuánta concurrencia lanzamos de una vez". Por debajo del
// límite defensivo del backend (100) y de max_host_connections (30) para dejar margen.
const BATCH_SIZE = 40

// Cachea todo lo pendiente de un resourceType, en lotes concurrentes en vez de un
// POST por item. Compartido entre useCacheAllResource (un único recurso, con su
// fila+botón en /cache) y useCacheEverything (los 49 de un tirón), para no repetir el
// mismo fetch-lista + cacheo-por-lotes en los dos hooks. Sigue siendo 100% manual: solo
// corre cuando algo llama a esta función desde un click, nunca en segundo plano.
export async function cacheAllPending(resourceType, { onTotal, onProgress } = {}) {
  const { data } = await axios.get(`/api/pokeapi/${resourceType}`)
  const pending = data.filter((entry) => !entry.cached)
  onTotal?.(pending.length)

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    try {
      await axios.post(`/api/pokeapi/${resourceType}/cache-batch`, {
        ids: batch.map((entry) => entry.id),
      })
    } catch {
      // se ignora un fallo puntual del lote y se sigue con el resto
    }
    onProgress?.(batch.length)
  }

  return pending.length
}
