import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useItemFicha from '../../hooks/useItemFicha.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { itemIconUrl, itemFallbackSpriteUrl } from '../../utils/itemSprite.js'
import { itemCategoryName, itemPocketName, itemAttributeName } from '../../utils/itemCategories.js'
import { itemFlavorTextsByVersionGroup, itemGenerations } from '../../utils/itemFicha.js'
import { localizedName } from '../../utils/pokeApiLocalization.js'
import { latestVersionedText } from '../../utils/pokemonFicha.js'
import { capitalize } from '../../utils/pokemonFormat.js'
import useImageFallback from '../../hooks/useImageFallback.js'
import styles from './ItemFichaPage.module.css'

function idFromUrl(url) {
  const segments = url.split('/').filter(Boolean)
  return Number(segments[segments.length - 1])
}

export default function ItemFichaPage() {
  const { idOrName } = useParams()
  const { status, ficha, error } = useItemFicha(idOrName)
  const { language } = useLanguage()
  const { t } = useTranslation()
  const pokemonNames = usePokemonNames()

  const item = ficha?.item
  const icon = useImageFallback(item ? itemIconUrl(item.name) : null, item ? itemFallbackSpriteUrl(item.name) : null)

  if (status === 'loading') return <p className={styles.status}>{t('ficha.loading')}</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!item) return null

  const displayName = localizedName(item, language, capitalize(item.name.replace(/-/g, ' ')))
  const category = item.category?.name ?? null
  const { text: effect, translated: effectTranslated } = latestVersionedText(
    item.effect_entries,
    language,
    'effect',
    ficha.wikidexEffectText,
  )
  const descriptions = itemFlavorTextsByVersionGroup(item, language)
  const generations = itemGenerations(item)

  return (
    <section className={styles.page}>
      <Link to="/objetos" className={styles.backLink}>
        ← {t('items.backToList')}
      </Link>

      <header className={styles.hero}>
        <div className={`${styles.iconWrap} hud-frame hud-frame--animated`}>
          <img src={icon.src} onError={icon.onError} alt={displayName} width={96} height={96} />
        </div>
        <div>
          <h1 className={styles.name}>{displayName}</h1>
          <div className={styles.badges}>
            {category && <span className={styles.badge}>{itemCategoryName(category, language)}</span>}
            {item.pocket_name && <span className={styles.badge}>{itemPocketName(item.pocket_name, language)}</span>}
            {item.taught_move && (
              <span className={styles.badge}>{item.taught_move.names?.[language] ?? item.taught_move.name}</span>
            )}
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('items.effect')}</h2>
          <p>
            {effect ?? t('ficha.noDescription')}
            {effect && !effectTranslated && <span className={styles.tag}>EN</span>}
          </p>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('items.description')}</h2>
          {descriptions.length > 0 ? (
            <ul className={styles.descList}>
              {descriptions.map((d) => (
                <li key={d.versionGroup}>
                  <strong>{capitalize(d.versionGroup.replace(/-/g, ' '))}</strong>
                  <p>
                    {d.text}
                    {!d.translated && <span className={styles.tag}>EN</span>}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('ficha.descriptionUnavailable')}</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('items.attributes')}</h2>
          <div className={styles.attrRow}>
            {item.cost != null && (
              <span className={styles.attrChip}>
                {t('items.cost')}: {item.cost}
              </span>
            )}
            {item.fling_power != null && (
              <span className={styles.attrChip}>
                {t('items.flingPower')}: {item.fling_power}
              </span>
            )}
            {(item.attributes ?? []).map((a) => (
              <span key={a.name} className={styles.attrChip}>
                {itemAttributeName(a.name, language)}
              </span>
            ))}
          </div>
          {generations.length > 0 && (
            <>
              <h3 className={styles.subTitle}>{t('items.appearsIn')}</h3>
              <div className={styles.attrRow}>
                {generations.map((g) => (
                  <span key={g} className={styles.genChip}>
                    G-{g}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('items.heldByPokemon')}</h2>
          {(item.held_by_pokemon ?? []).length > 0 ? (
            <div className={styles.heldList}>
              {item.held_by_pokemon.map((h) => {
                const id = idFromUrl(h.pokemon.url)
                return (
                  <Link key={h.pokemon.name} to={`/ficha/${id}`} className={styles.heldChip}>
                    {pokemonNames[id]?.names?.[language] ?? capitalize(h.pokemon.name.replace(/-/g, ' '))}
                  </Link>
                )
              })}
            </div>
          ) : (
            <p>{t('items.noHeldBy')}</p>
          )}
        </section>
      </div>
    </section>
  )
}
