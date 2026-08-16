// Orden y ángulos fijos para que coincida con el diseño de referencia (Dexter): HP
// arriba, y el resto en sentido horario cada 60°. Exportado porque PokemonFichaPage
// reusa el mismo orden/etiquetas para la lista de barras que acompaña al radar.
export const STAT_ORDER = ['hp', 'attack', 'defense', 'speed', 'special-defense', 'special-attack']
export const STAT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  speed: 'SPD',
  'special-defense': 'SP.DEF',
  'special-attack': 'SP.ATK',
}

export const MAX_STAT = 200
const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 36

function pointFor(index, value) {
  const angle = (Math.PI * 2 * index) / STAT_ORDER.length - Math.PI / 2
  const r = RADIUS * Math.min(value / MAX_STAT, 1)
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)]
}

export default function StatRadarChart({ stats, color }) {
  const byName = Object.fromEntries(stats.map((s) => [s.stat.name, s.base_stat]))
  const points = STAT_ORDER.map((name, i) => pointFor(i, byName[name] ?? 0))
  const polygon = points.map((p) => p.join(',')).join(' ')
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ color }}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={STAT_ORDER.map((_, i) => pointFor(i, MAX_STAT * ring).join(',')).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
        />
      ))}
      {STAT_ORDER.map((_, i) => {
        const [x, y] = pointFor(i, MAX_STAT)
        return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.2} />
      })}
      <polygon points={polygon} fill="currentColor" fillOpacity={0.3} stroke="currentColor" strokeWidth={2} />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill="currentColor" />
      ))}
      {STAT_ORDER.map((name, i) => {
        const [x, y] = pointFor(i, MAX_STAT * 1.22)
        return (
          <text key={name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="currentColor">
            {STAT_LABELS[name]} {byName[name] ?? 0}
          </text>
        )
      })}
    </svg>
  )
}
