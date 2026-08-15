import StatusRow from './components/StatusRow/StatusRow.jsx'
import useServiceHealth from './hooks/useServiceHealth.js'
import styles from './App.module.css'

function App() {
  const { backend, database, retry } = useServiceHealth()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PokeWebMax</h1>

      <div className={styles.statusList}>
        <StatusRow label="Frontend" state="ok" value="funcionando" />
        <StatusRow label="Backend API" state={backend.state} value={backend.value} />
        <StatusRow label="Base de datos" state={database.state} value={database.value} />
      </div>

      <button type="button" className={styles.retry} onClick={retry}>
        Volver a comprobar
      </button>
    </main>
  )
}

export default App
