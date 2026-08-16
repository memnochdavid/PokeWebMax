import { useEffect, useState } from 'react'
import axios from 'axios'

// Nombre de cada especie cacheada en cada idioma soportado (GET /api/pokemon/names) —
// para localizar nombres donde no se tiene la especie completa cargada: la lista de
// Pokémon y los nombres de la cadena evolutiva en la ficha (que sí tiene su propio
// Pokémon actual localizado directamente desde `species.names`, sin pasar por aquí).
export default function usePokemonNames() {
  const [names, setNames] = useState({})

  useEffect(() => {
    axios
      .get('/api/pokemon/names')
      .then(({ data }) => setNames(data))
      .catch(() => {
        // sin nombres localizados no es crítico — los llamadores caen al slug en inglés
      })
  }, [])

  return names
}
