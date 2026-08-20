import { useEffect, useState } from 'react'
import axios from 'axios'

// Nombre de cada objeto cacheado en cada idioma soportado (GET /api/items/names) —
// mismo criterio que usePokemonNames: para sitios que solo tienen el slug/id del
// objeto a mano (ej. el objeto de una evolución en la ficha de Pokémon) sin cargar el
// listado completo de /objetos.
export default function useItemNames() {
  const [names, setNames] = useState({})

  useEffect(() => {
    axios
      .get('/api/items/names')
      .then(({ data }) => setNames(data))
      .catch(() => {
        // sin nombres localizados no es crítico — los llamadores caen al slug en inglés
      })
  }, [])

  return names
}
