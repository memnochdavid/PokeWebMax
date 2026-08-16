import styles from './StatusRow.module.css'

const DOT_CLASS = {
  ok: styles.dotOk,
  error: styles.dotError,
  pending: styles.dotPending,
}

export default function StatusRow({ label, state, value }) {
  return (
    <div className={styles.statusRow}>
      <span className={styles.label}>
        <span className={`${styles.dot} ${DOT_CLASS[state] ?? DOT_CLASS.error}`} />
        {label}
      </span>
      <span className={styles.value}>{value}</span>
    </div>
  )
}
