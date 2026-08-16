import StatusRow from '../../components/StatusRow/StatusRow.jsx'
import useServiceHealth from '../../hooks/useServiceHealth.js'
import styles from './StatusPage.module.css'

export default function StatusPage() {
  const { backend, database, retry } = useServiceHealth()

  return (
    <section className={styles.page}>
      <div className={styles.panel}>
        <span className="eyebrow">Diagnóstico del sistema</span>
        <h1 className={styles.title}>PokeWebMax</h1>

        <div className={styles.statusList}>
          <StatusRow label="Frontend" state="ok" value="funcionando" />
          <StatusRow label="Backend API" state={backend.state} value={backend.value} />
          <StatusRow label="Base de datos" state={database.state} value={database.value} />
        </div>

        <button type="button" className={styles.retry} onClick={retry}>
          Volver a comprobar
        </button>
      </div>
    </section>
  )
}
