import useVideoFallback from '../../hooks/useVideoFallback.js'

// Banner de la ficha: intenta el sprite animado local (public/animated/), y si no hay
// (no está en el pack) o falla al cargar, cae al sprite estático (ya con su propio
// fallback resuelto por el llamador, ver useImageFallback).
export default function PokemonHeroSprite({ animatedSrc, staticSrc, staticOnError, alt, width, height, className }) {
  const video = useVideoFallback()
  const useVideo = Boolean(animatedSrc) && !video.failed

  if (!useVideo) {
    return (
      <img className={className} src={staticSrc} onError={staticOnError} alt={alt} width={width} height={height} />
    )
  }

  return (
    <video
      className={className}
      src={animatedSrc}
      onError={video.onError}
      width={width}
      height={height}
      autoPlay
      loop
      muted
      playsInline
    />
  )
}
