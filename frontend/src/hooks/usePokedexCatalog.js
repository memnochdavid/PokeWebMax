import { useEffect, useState } from 'react'
import axios from 'axios'

// Catálogo de Pokédex regionales + juegos (GET /api/pokedex-catalog) — alimenta el
// selector Nacional/Regional de la lista de Pokémon. Payload pequeño y ya cacheado en
// el backend, así que no hace falta caché cliente propia (a diferencia de
// usePokemonList/pokemonListCache.js).
export default function usePokedexCatalog() {
  const [catalog, setCatalog] = useState({ pokedexes: [], versions: [] })

  useEffect(() => {
    axios
      .get('/api/pokedex-catalog')
      .then(({ data }) => setCatalog(data))
      .catch(() => {
        // sin catálogo no es crítico — el selector Regional simplemente no tiene opciones
      })
  }, [])

  return catalog
}
