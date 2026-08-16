import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { typeColor, typeIconUrl, typeName } from '../../utils/pokemonTypes.js'
import styles from './TypeBadge.module.css'

export default function TypeBadge({ type }) {
  const { language } = useLanguage()

  return (
    <span className={styles.badge} style={{ backgroundColor: typeColor(type) }}>
      <img className={styles.icon} src={typeIconUrl(type)} alt="" />
      {typeName(type, language)}
    </span>
  )
}
