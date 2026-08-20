import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useItemList from '../../hooks/useItemList.js'
import useViewMode from '../../hooks/useViewMode.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import ItemCard from '../../components/ItemCard/ItemCard.jsx'
import ItemTable from '../../components/ItemTable/ItemTable.jsx'
import ViewModeToggle from '../../components/ViewModeToggle/ViewModeToggle.jsx'
import { itemCategoryName, itemPocketName, ITEM_POCKETS } from '../../utils/itemCategories.js'
import { capitalize } from '../../utils/pokemonFormat.js'
import styles from './ItemsListPage.module.css'

const COMBINING_MARKS_RE = new RegExp('[̀-ͯ]', 'g')
const VIEW_MODES = ['grid', 'table']

function normalize(text) {
  return text.normalize('NFKD').replace(COMBINING_MARKS_RE, '').toLowerCase()
}

export default function ItemsListPage() {
  const { status, items, error, reload } = useItemList()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [pocket, setPocket] = useState('')
  const [viewMode, setViewMode] = useViewMode(VIEW_MODES, 'grid', 'pokewebmax:itemsListViewMode')

  const visible = useMemo(() => {
    const query = normalize(search.trim())
    return items.filter((entry) => {
      if (pocket && entry.pocket !== pocket) return false
      if (!query) return true
      const displayName = entry.names?.[language] ?? entry.name
      return normalize(displayName).includes(query) || normalize(entry.name).includes(query)
    })
  }, [items, search, pocket, language])

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">{t('items.eyebrow')}</span>
          <h1 className={styles.title}>{t('items.title')}</h1>
        </div>
        <div className={styles.headerControls}>
          <ViewModeToggle
            modes={[
              { value: 'grid', label: t('list.viewGrid') },
              { value: 'table', label: t('list.viewTable') },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
            {status === 'loading' ? t('list.loading') : t('list.reload')}
          </button>
        </div>
      </div>

      {status === 'error' && <p className={styles.error}>{error}</p>}

      {status === 'success' && items.length === 0 && <p className={styles.empty}>{t('items.empty')}</p>}

      {items.length > 0 && (
        <>
          <div className={styles.filters}>
            <input
              type="text"
              className={styles.search}
              placeholder={t('filters.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={styles.pocketSelect} value={pocket} onChange={(e) => setPocket(e.target.value)}>
              <option value="">{t('items.allPockets')}</option>
              {ITEM_POCKETS.map((slug) => (
                <option key={slug} value={slug}>
                  {itemPocketName(slug, language)}
                </option>
              ))}
            </select>
            <span className={styles.count}>{t('items.resultCount', { count: visible.length })}</span>
          </div>

          <div className={styles.results}>
            {visible.length === 0 ? (
              <p className={styles.empty}>{t('list.emptyFiltered')}</p>
            ) : viewMode === 'table' ? (
              <ItemTable entries={visible} language={language} />
            ) : (
              <ul className={styles.grid}>
                {visible.map((entry) => (
                  <li key={entry.id}>
                    <ItemCard
                      name={entry.name}
                      displayName={entry.names?.[language] ?? capitalize(entry.name.replace(/-/g, ' '))}
                      categoryLabel={itemCategoryName(entry.category, language)}
                      moveLabel={entry.move?.names?.[language] ?? entry.move?.name}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
