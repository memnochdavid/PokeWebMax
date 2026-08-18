import { useTranslation } from 'react-i18next'
import useCacheAllResource from '../../hooks/useCacheAllResource.js'
import useCacheEverything from '../../hooks/useCacheEverything.js'
import useServiceHealth from '../../hooks/useServiceHealth.js'
import StatusRow from '../../components/StatusRow/StatusRow.jsx'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { RESOURCE_GROUPS } from '../../utils/pokeApiResources.js'
import styles from './CacheAllPage.module.css'

function ResourceCacheRow({ resourceType, label }) {
  const { status, total, done, error, start } = useCacheAllResource(resourceType)
  const { t } = useTranslation()
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <tr>
      <td className={styles.resourceName}>{label}</td>
      <td className={styles.statusCell}>
        {status === 'running' && (
          <span className={styles.progress}>
            <span className={styles.track}>
              <span className={styles.bar} style={{ width: `${progress}%` }} />
            </span>
            <span className={styles.progressLabel}>
              {done}/{total}
            </span>
          </span>
        )}
        {status === 'done' && <span className={styles.done}>{t('cache.resourceDone', { count: total })}</span>}
        {status === 'error' && (
          <span className={styles.error} title={error}>
            {error}
          </span>
        )}
      </td>
      <td className={styles.actionCell}>
        <button type="button" className={styles.miniButton} onClick={start} disabled={status === 'running'}>
          {status === 'running' ? t('cache.cachingButton') : t('cache.cacheButton')}
        </button>
      </td>
    </tr>
  )
}

// Franja compacta de estado de los 3 servicios (antes su propia página /status,
// David pidió fusionarla con /cache) — mismos StatusRow/useServiceHealth de siempre,
// solo que en fila en vez de apilados en un panel centrado aparte.
function StatusStrip() {
  const { backend, database, retry } = useServiceHealth()
  const { t } = useTranslation()

  const backendValue = backend === 'pending' ? t('status.pending') : t(`status.backend${backend === 'ok' ? 'Ok' : 'Error'}`)
  const databaseValue =
    database === 'pending'
      ? t('status.pending')
      : t(`status.database${{ ok: 'Ok', error: 'Error', unknown: 'Unknown' }[database]}`)

  return (
    <div className={styles.statusStrip}>
      <StatusRow label={t('status.frontend')} state="ok" value={t('status.frontendOk')} />
      <StatusRow label={t('status.backendApi')} state={backend} value={backendValue} />
      <StatusRow label={t('status.database')} state={database} value={databaseValue} />
      <button type="button" className={styles.miniButton} onClick={retry}>
        {t('status.retry')}
      </button>
    </div>
  )
}

export default function CacheAllPage() {
  const { status, currentType, resourcesDone, totalResources, error, start } = useCacheEverything()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const progress = totalResources > 0 ? Math.round((resourcesDone / totalResources) * 100) : 0

  return (
    <section className={styles.page}>
      <span className="eyebrow">{t('cache.eyebrow')}</span>
      <h1 className={styles.title}>{t('cache.title')}</h1>

      <StatusStrip />

      <div className={`${styles.row} ${styles.master}`}>
        <div className={styles.rowHeader}>
          <span className={styles.rowLabel}>{t('cache.allLabel')}</span>
          <button
            type="button"
            className={styles.button}
            onClick={start}
            disabled={status === 'running'}
          >
            {status === 'running' ? t('cache.cachingAllButton') : t('cache.cacheAllButton')}
          </button>
        </div>

        {status === 'running' && (
          <div className={styles.progress}>
            <div className={styles.track}>
              <div className={styles.bar} style={{ width: `${progress}%` }} />
            </div>
            <span>{t('cache.allProgress', { done: resourcesDone, total: totalResources, currentType })}</span>
          </div>
        )}

        {status === 'done' && <p className={styles.done}>{t('cache.allDone', { count: totalResources })}</p>}

        {status === 'error' && <p className={styles.error}>{error}</p>}
      </div>

      {RESOURCE_GROUPS.map((group) => (
        <div key={group.label.es} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.label[language]}</h2>
          <table className={styles.table}>
            <tbody>
              {group.resources.map(({ type, label }) => (
                <ResourceCacheRow key={type} resourceType={type} label={label[language]} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}
