import { useEffect, useRef } from 'react'

// El <video> HTML5 no puede mostrar transparencia aunque el .webm tenga canal alfa
// (limitación del elemento, no del archivo) — así que se dibuja cada frame en un
// <canvas> oculto y se convierten a transparentes los píxeles casi-blancos (el fondo
// que traen estos sprites). Es un chroma-key por color, no canal alfa real: puede
// recortar partes genuinamente blancas del sprite (ojos, dientes...) si el umbral es
// demasiado agresivo.
const WHITE_HIGH = 250 // a partir de aquí, totalmente transparente
const WHITE_LOW = 235 // por debajo de aquí, totalmente opaco

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export default function useChromaKeyVideo(src) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !src) return undefined

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let frameId

    const draw = () => {
      if (video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        ctx.drawImage(video, 0, 0)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = frame.data

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const whiteness = (r + g + b) / 3

          let alpha = 255
          if (whiteness >= WHITE_HIGH) {
            alpha = 0
          } else if (whiteness > WHITE_LOW) {
            alpha = Math.round((255 * (WHITE_HIGH - whiteness)) / (WHITE_HIGH - WHITE_LOW))
          }

          // En el borde, el frame original mezcla el color del sprite con el blanco de
          // fondo (antialiasing) — bajar solo el alpha deja un halo blanco, porque el
          // color de ese píxel sigue "sangrado" hacia blanco. Se limpia deshaciendo esa
          // mezcla (unpremultiply contra fondo blanco) para recuperar el color real.
          if (alpha > 0 && alpha < 255) {
            const a = alpha / 255
            data[i] = clamp255((r - (1 - a) * 255) / a)
            data[i + 1] = clamp255((g - (1 - a) * 255) / a)
            data[i + 2] = clamp255((b - (1 - a) * 255) / a)
          }

          data[i + 3] = alpha
        }

        ctx.putImageData(frame, 0, 0)
      }
      frameId = requestAnimationFrame(draw)
    }

    frameId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(frameId)
  }, [src])

  return { videoRef, canvasRef }
}
