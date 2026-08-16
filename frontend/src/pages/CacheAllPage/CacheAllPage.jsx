import { useTranslation } from 'react-i18next'
import useCacheAllResource from '../../hooks/useCacheAllResource.js'
import useCacheEverything from '../../hooks/useCacheEverything.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { RESOURCE_GROUPS } from '../../utils/pokeApiResources.js'
import styles from './CacheAllPage.module.css'

function ResourceCacheRow({ resourceType, label }) {
  const { status, total, done, error, start } = useCacheAllResource(resourceType)
  const { t } = useTranslation()
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
          {status === 'running' ? t('cache.cachingButton') : t('cache.cacheButton')}
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

      {status === 'done' && <p className={styles.done}>{t('cache.resourceDone', { count: total })}</p>}

      {status === 'error' && <p className={styles.error}>{error}</p>}
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
          {group.resources.map(({ type, label }) => (
            <ResourceCacheRow key={type} resourceType={type} label={label[language]} />
          ))}
        </div>
      ))}
    </section>
  )
}
