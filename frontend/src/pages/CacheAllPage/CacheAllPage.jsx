import useCacheAllResource from '../../hooks/useCacheAllResource.js'
import useCacheEverything from '../../hooks/useCacheEverything.js'
import { RESOURCE_GROUPS } from '../../utils/pokeApiResources.js'
import styles from './CacheAllPage.module.css'

function ResourceCacheRow({ resourceType, label }) {
  const { status, total, done, error, start } = useCacheAllResource(resourceType)
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowLabel}>{label}</span>
        <button
          type="button"
          className={styles.button}
          onClick={start}
          disabled={status === 'running'}
        >
          {status === 'running' ? 'Cacheando…' : 'Cachear todo'}
        </button>
      </div>

      {status === 'running' && (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.bar} style={{ width: `${progress}%` }} />
          </div>
          <span>
            {done} / {total} ({progress}%)
          </span>
        </div>
      )}

      {status === 'done' && (
        <p className={styles.done}>Listo: {total} procesados.</p>
      )}

      {status === 'error' && <p className={styles.error}>{error}</p>}
    </div>
  )
}

export default function CacheAllPage() {
  const { status, currentType, resourcesDone, totalResources, error, start } = useCacheEverything()
  const progress = totalResources > 0 ? Math.round((resourcesDone / totalResources) * 100) : 0

  return (
    <section className={styles.page}>
      <span className="eyebrow">Adquisición de datos</span>
      <h1 className={styles.title}>Cachear PokeAPI</h1>

      <div className={`${styles.row} ${styles.master}`}>
        <div className={styles.rowHeader}>
          <span className={styles.rowLabel}>Todo (49 recursos)</span>
          <button
            type="button"
            className={styles.button}
            onClick={start}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Cacheando todo…' : 'Cachear todo lo que falta'}
          </button>
        </div>

        {status === 'running' && (
          <div className={styles.progress}>
            <div className={styles.track}>
              <div className={styles.bar} style={{ width: `${progress}%` }} />
            </div>
            <span>
              {resourcesDone} / {totalResources} recursos ({currentType})
            </span>
          </div>
        )}

        {status === 'done' && (
          <p className={styles.done}>Listo: los {totalResources} recursos están al día.</p>
        )}

        {status === 'error' && <p className={styles.error}>{error}</p>}
      </div>

      {RESOURCE_GROUPS.map((group) => (
        <div key={group.label} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.label}</h2>
          {group.resources.map(({ type, label }) => (
            <ResourceCacheRow key={type} resourceType={type} label={label} />
          ))}
        </div>
      ))}
    </section>
  )
}
