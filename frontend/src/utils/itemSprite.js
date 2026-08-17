import itemIconMap from './itemIconMap.generated.json'

// Icono local (WikiDex, ver scripts/build_item_icon_map.py) si el objeto está en el
// cruce; si no (~1500/2223, sobre todo MT/MO individuales y objetos sin página propia
// en WikiDex con infobox {{Objeto}}/{{Baya}}), cae al sprite que ya aloja PokeAPI en
// GitHub — mismo patrón de fallback remoto que officialArtworkUrl en
// PokemonFichaPage.jsx. Se combina con useImageFallback (primario local, onError →
// remoto) por si el fichero local existiera en el mapa pero no en disco.
export function itemIconUrl(itemSlug) {
  const localFile = itemIconMap[itemSlug]
  return localFile ? `/objects/${localFile}` : itemFallbackSpriteUrl(itemSlug)
}

export function itemFallbackSpriteUrl(itemSlug) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemSlug}.png`
}
