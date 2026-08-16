// Traduce el slug de PokeAPI (pokemon.name, ej. "raichu-alola") al nombre de archivo
// del pack animado en public/animated/ (carpeta gitignored — assets con copyright,
// copiados manualmente por David, no se suben al repo). Puerto del criterio que ya
// usaba la app Android de referencia (transformPokemonNameToResourceName en
// SpriteWebm.kt) para las formas regionales/mega/de género, adaptado a que aquí
// siempre partimos del slug en inglés de PokeAPI en vez del nombre localizado.
const NAME_OVERRIDES = {
  'type-null': 'codigo_cero',
}

export function animatedSpriteResourceName(pokemonApiName) {
  const override = NAME_OVERRIDES[pokemonApiName]
  if (override) return override

  const lower = pokemonApiName.toLowerCase()
  if (!lower.includes('-')) return lower

  const partes = lower.split('-')

  if (partes.length === 2 && partes[1] === 'mega') return `mega_${partes[0]}`
  if (partes.length === 3 && partes[1] === 'mega') return `mega_${partes[0]}_${partes[2]}`

  switch (partes[1]) {
    case 'alola':
      return `${partes[0]}_de_alola`
    case 'galar':
      return `${partes[0]}_de_galar`
    case 'hisui':
      return `${partes[0]}_de_hisui`
    case 'paldea':
      if (partes[0] === 'tauros') {
        if (partes[2] === 'blaze') return `${partes[0]}_de_paldea_ardiente`
        if (partes[2] === 'aqua') return `${partes[0]}_de_paldea_acuatica`
        if (partes[2] === 'combat') return `${partes[0]}_de_paldea_combatiente`
      }
      return `${partes[0]}_de_paldea`
    case 'f':
      return `${partes[0]}_hembra`
    case 'm':
      return `${partes[0]}_macho`
    case 'shield':
      return `${partes[0]}_escudo`
    case 'z':
      return `${partes[0]}_z`
    default:
      return `${partes[0]}_${partes[1]}`
  }
}

export function animatedSpriteUrl(pokemonApiName) {
  return `/animated/${animatedSpriteResourceName(pokemonApiName)}.webm`
}
