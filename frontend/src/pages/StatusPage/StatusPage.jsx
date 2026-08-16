import { useTranslation } from 'react-i18next'
import StatusRow from '../../components/StatusRow/StatusRow.jsx'
import useServiceHealth from '../../hooks/useServiceHealth.js'
import styles from './StatusPage.module.css'

export default function StatusPage() {
  const { backend, database, retry } = useServiceHealth()
  const { t } = useTranslation()

  const backendValue = backend === 'pending' ? t('status.pending') : t(`status.backend${backend === 'ok' ? 'Ok' : 'Error'}`)
  const databaseValue =
    database === 'pending'
      ? t('status.pending')
      : t(`status.database${{ ok: 'Ok', error: 'Error', unknown: 'Unknown' }[database]}`)

  return (
    <section className={styles.page}>
      <div className={styles.panel}>
        <span className="eyebrow">{t('status.eyebrow')}</span>
        <h1 className={styles.title}>{t('status.title')}</h1>

        <div className={styles.statusList}>
          <StatusRow label={t('status.frontend')} state="ok" value={t('status.frontendOk')} />
          <StatusRow label={t('status.backendApi')} state={backend} value={backendValue} />
          <StatusRow label={t('status.database')} state={database} value={databaseValue} />
        </div>

        <button type="button" className={styles.retry} onClick={retry}>
          {t('status.retry')}
        </button>
      </div>
    </section>
  )
}
