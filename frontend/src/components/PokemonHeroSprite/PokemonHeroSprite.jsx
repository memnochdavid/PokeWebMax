import useVideoFallback from '../../hooks/useVideoFallback.js'
import useChromaKeyVideo from '../../hooks/useChromaKeyVideo.js'

// Banner de la ficha: intenta el sprite animado local (public/animated/), y si no hay
// (no está en el pack) o falla al cargar, cae al sprite estático (ya con su propio
// fallback resuelto por el llamador, ver useImageFallback). El vídeo se renderiza vía
// canvas con chroma-key (ver useChromaKeyVideo) para quitar el fondo blanco que traen
// estos .webm, ya que el <video> nativo no puede mostrar transparencia.
export default function PokemonHeroSprite({ animatedSrc, staticSrc, staticOnError, alt, width, height, className }) {
  const video = useVideoFallback()
  const useVideoSprite = Boolean(animatedSrc) && !video.failed
  const { videoRef, canvasRef } = useChromaKeyVideo(useVideoSprite ? animatedSrc : null)

  if (!useVideoSprite) {
    return (
      <img className={className} src={staticSrc} onError={staticOnError} alt={alt} width={width} height={height} />
    )
  }

  return (
    <>
      <video
        ref={videoRef}
        src={animatedSrc}
        onError={video.onError}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <canvas ref={canvasRef} className={className} width={width} height={height} role="img" aria-label={alt} />
    </>
  )
}
