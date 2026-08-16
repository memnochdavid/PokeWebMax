import axios from 'axios'

// Cachea todo lo pendiente de un resourceType. Compartido entre useCacheAllResource
// (un único recurso, con su fila+botón en /cache) y useCacheEverything (los 49 de un
// tirón), para no repetir el mismo fetch-lista + POST-por-item en los dos hooks.
export async function cacheAllPending(resourceType, { onTotal, onProgress } = {}) {
  const { data } = await axios.get(`/api/pokeapi/${resourceType}`)
  const pending = data.filter((entry) => !entry.cached)
  onTotal?.(pending.length)

  for (const entry of pending) {
    try {
      await axios.post(`/api/pokeapi/${resourceType}/cache/${entry.id}`)
    } catch {
      // se ignora un fallo puntual y se sigue con el resto
    }
    onProgress?.()
  }

  return pending.length
}
