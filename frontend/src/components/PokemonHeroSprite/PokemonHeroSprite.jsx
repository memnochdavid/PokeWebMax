import useAnimatedSpriteFallback from '../../hooks/useAnimatedSpriteFallback.js'

// Banner de la ficha: intenta el sprite animado local (public/animated/), y si no hay
// (no está en el pack) o falla al cargar, cae al sprite estático (ya con su propio
// fallback resuelto por el llamador, ver useImageFallback). El pack es .webp animado
// con canal alfa real (a diferencia del .webm anterior, que traía fondo blanco y
// necesitaba un chroma-key por canvas para quitarlo — ya no hace falta), así que un
// <img> normal basta.
export default function PokemonHeroSprite({ animatedSrc, staticSrc, staticOnError, alt, width, height, className }) {
  const sprite = useAnimatedSpriteFallback()
  const useAnimated = Boolean(animatedSrc) && !sprite.failed

  if (!useAnimated) {
    return (
      <img className={className} src={staticSrc} onError={staticOnError} alt={alt} width={width} height={height} />
    )
  }

  return (
    <img
      className={className}
      src={animatedSrc}
      onError={sprite.onError}
      alt={alt}
      width={width}
      height={height}
    />
  )
}
