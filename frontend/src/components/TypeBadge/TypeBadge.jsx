import { typeColor, typeIconUrl, typeNameEs } from '../../utils/pokemonTypes.js'
import styles from './TypeBadge.module.css'

export default function TypeBadge({ type }) {
  return (
    <span className={styles.badge} style={{ backgroundColor: typeColor(type) }}>
      <img className={styles.icon} src={typeIconUrl(type)} alt="" />
      {typeNameEs(type)}
    </span>
  )
}
