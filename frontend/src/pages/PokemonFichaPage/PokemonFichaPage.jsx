import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import usePokemonFicha from '../../hooks/usePokemonFicha.js'
import useFichaSection from '../../hooks/useFichaSection.js'
import useImageFallback from '../../hooks/useImageFallback.js'
import useSelectedVersion from '../../hooks/useSelectedVersion.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import TypeBadge from '../../components/TypeBadge/TypeBadge.jsx'
import PokemonHeroSprite from '../../components/PokemonHeroSprite/PokemonHeroSprite.jsx'
import StatRadarChart from '../../components/StatRadarChart/StatRadarChart.jsx'
import { typeColor } from '../../utils/pokemonTypes.js'
import { spriteHomeUrl } from '../../utils/spritesHome.js'
import { animatedSpriteUrl } from '../../utils/animatedSprite.js'
import { capitalize, formatPokedexNumber } from '../../utils/pokemonFormat.js'
import { localizedName } from '../../utils/pokeApiLocalization.js'
import {
  FICHA_SECTIONS,
  damageClassName,
  evolutionStages,
  flavorTextsByVersion,
  genusForLanguage,
  generationNumber,
  latestVersionedText,
  sectionMissingCount,
  speciesDisplayName,
  totalMissing,
} from '../../utils/pokemonFicha.js'
import styles from './PokemonFichaPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function PokemonFichaPage() {
  const { idOrName } = useParams()
  const { status, ficha, error, caching, cacheMissing } = usePokemonFicha(idOrName)
  const { section, setSection } = useFichaSection('DESC')
  const { version: selectedVersion, setVersion } = useSelectedVersion()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const pokemonNames = usePokemonNames()
  const [expandedMoves, setExpandedMoves] = useState(() => new Set())
  const toggleMove = (id) =>
    setExpandedMoves((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const pokemon = ficha?.pokemon
  const heroImage = useImageFallback(
    pokemon ? spriteHomeUrl(pokemon.id) : null,
    pokemon ? (pokemon.sprites.other?.['official-artwork']?.front_default ?? officialArtworkUrl(pokemon.id)) : null,
  )

  if (status === 'loading') return <p className={styles.status}>{t('ficha.loading')}</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!ficha) return null

  const { species, evolutionChain, moves, abilities, forms, missing, wikidexFlavorText } = ficha
  const types = pokemon.types.map((t) => t.type.name)
  const primaryColor = typeColor(types[0])
  const secondaryColor = typeColor(types[1] ?? types[0])
  const missingTotal = totalMissing(missing)
  const generation = generationNumber(species)

  const versions = flavorTextsByVersion(species, language, wikidexFlavorText)
  const activeVersion = versions.find((v) => v.version === selectedVersion) ?? versions[0]
  const displayName = speciesDisplayName(species, language, capitalize(pokemon.name))

  return (
    <section className={styles.page}>
      {missingTotal > 0 && (
        <div className={styles.cacheBar}>
          <span>{t('ficha.cacheBarMissing', { count: missingTotal })}</span>
          <button type="button" onClick={cacheMissing} disabled={caching}>
            {caching ? t('ficha.cachingButton') : t('ficha.cacheButton')}
          </button>
        </div>
      )}

      <div className={styles.layout}>
      <header className={styles.hero}>
        <div
          className={styles.heroBands}
          style={{
            background: `linear-gradient(to bottom, ${primaryColor} 0%, ${primaryColor} 58%, ${secondaryColor} 58%, ${secondaryColor} 100%)`,
          }}
        >
          <div className={`${styles.scanChamber} hud-frame hud-frame--animated`} style={{ color: '#fff' }}>
            <PokemonHeroSprite
              className={styles.sprite}
              animatedSrc={animatedSpriteUrl(pokemon.name)}
              staticSrc={heroImage.src}
              staticOnError={heroImage.onError}
              alt={pokemon.name}
              width={200}
              height={200}
            />
          </div>
        </div>

        <div className={styles.infoBand} style={{ background: primaryColor }}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{displayName}</h1>
            <span className={styles.number}>{formatPokedexNumber(pokemon.id)}</span>
          </div>
          {genusForLanguage(species, language) && <p className={styles.genus}>{genusForLanguage(species, language)}</p>}
          {generation && <span className={styles.genChip}>G-{generation}</span>}
          <div className={styles.metrics}>
            <span className={styles.metricChip}>
              {t('ficha.height')} <strong>{(pokemon.height / 10).toFixed(1)} m</strong>
            </span>
            <span className={styles.metricChip}>
              {t('ficha.weight')} <strong>{(pokemon.weight / 10).toFixed(1)} kg</strong>
            </span>
          </div>
        </div>
      </header>

      <div className={styles.main}>
      <nav className={styles.tabs}>
        {FICHA_SECTIONS.map(({ key, label, missingKey }) => {
          const count = sectionMissingCount(missing, missingKey)
          const active = section === key
          return (
            <button
              key={key}
              type="button"
              className={styles.tab}
              style={active ? { background: primaryColor, color: '#fff' } : undefined}
              onClick={() => setSection(key)}
            >
              {label[language]}
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className={styles.content}>
        {section === 'DESC' && (
          <div>
            {versions.length > 0 ? (
              <>
                <div className={styles.versionPicker}>
                  {versions.map((v) => (
                    <button
                      key={v.version}
                      type="button"
                      className={styles.versionChip}
                      style={v.version === activeVersion?.version ? { background: primaryColor, color: '#fff' } : undefined}
                      onClick={() => setVersion(v.version)}
                    >
                      {capitalize(v.version.replace(/-/g, ' '))}
                      {!v.translated && <span className={styles.tag}>EN</span>}
                    </button>
                  ))}
                </div>
                <p className={styles.quote}>
                  “{activeVersion.text}”
                  {!activeVersion.translated && (
                    <span className={styles.notTranslated}>{t('ficha.notTranslated')}</span>
                  )}
                </p>
              </>
            ) : (
              <p>{t('ficha.descriptionUnavailable')}</p>
            )}
          </div>
        )}

        {section === 'EVOS' && (
          evolutionChain ? (
            <div className={styles.evoList}>
              {evolutionStages(evolutionChain, t).map((stage, i) => (
                <div key={stage.id}>
                  {i > 0 && <div className={styles.evoConnector}>{stage.method}</div>}
                  <Link to={`/ficha/${stage.id}`} className={styles.evoCard}>
                    <img
                      className={styles.evoSprite}
                      src={spriteHomeUrl(stage.id) ?? officialArtworkUrl(stage.id)}
                      alt={stage.name}
                      width={64}
                      height={64}
                    />
                    <div>
                      <strong>{pokemonNames[stage.id]?.[language] ?? capitalize(stage.name)}</strong>
                      <span className={styles.evoNumber}>{formatPokedexNumber(stage.id)}</span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p>{t('ficha.evoChainMissing')}</p>
          )
        )}

        {section === 'STATS' && (
          <div className={styles.statsPanel}>
            <StatRadarChart stats={pokemon.stats} color={primaryColor} />
            <p className={styles.statsTotal}>
              {t('ficha.statsTotal')} <strong>{pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0)}</strong>
            </p>
          </div>
        )}

        {section === 'ABILITY' && (
          <ul className={styles.cardList}>
            {abilities.map((a) => {
              const hidden = pokemon.abilities.find((slot) => slot.ability.name === a.name)?.is_hidden
              const { text: effect, translated } = latestVersionedText(a.payload?.flavor_text_entries, language)
              const abilityName = localizedName(a.payload, language, capitalize(a.name.replace(/-/g, ' ')))

              return (
                <li key={a.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <strong>{abilityName}</strong>
                    {hidden && <span className={styles.tag}>{t('ficha.hiddenAbility')}</span>}
                    {effect && !translated && <span className={styles.tag}>EN</span>}
                  </div>
                  {a.cached ? (
                    <p>{effect ?? t('ficha.noDescription')}</p>
                  ) : (
                    <p className={styles.notCached}>{t('ficha.notCachedAbility')}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {section === 'MOVES' && (
          <ul className={styles.cardList}>
            {moves.map((m) => {
              const expanded = expandedMoves.has(m.id)
              const { text: description, translated } = latestVersionedText(m.payload?.flavor_text_entries, language)

              return (
                <li
                  key={m.id}
                  className={m.cached ? `${styles.card} ${styles.clickableCard}` : styles.card}
                  onClick={m.cached ? () => toggleMove(m.id) : undefined}
                  role={m.cached ? 'button' : undefined}
                  tabIndex={m.cached ? 0 : undefined}
                  onKeyDown={
                    m.cached
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleMove(m.id)
                          }
                        }
                      : undefined
                  }
                >
                  <div className={styles.cardHeader}>
                    <strong>{localizedName(m.payload, language, capitalize(m.name.replace(/-/g, ' ')))}</strong>
                    {m.payload && <TypeBadge type={m.payload.type.name} />}
                  </div>
                  {m.cached ? (
                    <>
                      <div className={styles.moveStats}>
                        <span>
                          {t('ficha.movePower')} <strong>{m.payload.power ?? '-'}</strong>
                        </span>
                        <span>
                          {t('ficha.movePP')} <strong>{m.payload.pp ?? '-'}</strong>
                        </span>
                        <span>
                          {t('ficha.moveAccuracy')} <strong>{m.payload.accuracy != null ? `${m.payload.accuracy}%` : '-'}</strong>
                        </span>
                        <span className={styles.tag}>{damageClassName(m.payload.damage_class.name, language)}</span>
                      </div>
                      {expanded && (
                        <p className={styles.moveDescription}>
                          {description ?? t('ficha.noDescription')}
                          {description && !translated && <span className={styles.tag}> EN</span>}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className={styles.notCached}>{t('ficha.notCachedMove')}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {section === 'INFO' && (
          species ? (
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.baseExp')}</dt>
                <dd>{pokemon.base_experience ?? '-'}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.gender')}</dt>
                <dd>
                  {species.gender_rate === -1 ? (
                    t('ficha.info.noGender')
                  ) : (
                    <div className={styles.genderBar}>
                      <div className={styles.genderMale} style={{ width: `${((8 - species.gender_rate) / 8) * 100}%` }} />
                      <div className={styles.genderFemale} style={{ width: `${(species.gender_rate / 8) * 100}%` }} />
                    </div>
                  )}
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.capture')}</dt>
                <dd>
                  <div className={styles.captureBar}>
                    <div className={styles.captureFill} style={{ width: `${(species.capture_rate / 255) * 100}%` }} />
                  </div>
                  <span>{species.capture_rate} / 255</span>
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.baseHappiness')}</dt>
                <dd>{species.base_happiness}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.eggGroup')}</dt>
                <dd>{species.egg_groups.map((g) => capitalize(g.name)).join(', ')}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.hatchSteps')}</dt>
                <dd>~{(species.hatch_counter + 1) * 255}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>{t('ficha.info.growthRate')}</dt>
                <dd>{capitalize(species.growth_rate.name.replace(/-/g, ' '))}</dd>
              </div>
              {species.habitat && (
                <div className={styles.infoRow}>
                  <dt>{t('ficha.info.habitat')}</dt>
                  <dd>{capitalize(species.habitat.name)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p>{t('ficha.cacheToViewInfo')}</p>
          )
        )}

        {section === 'FORM' && (
          <ul className={styles.cardList}>
            {forms.map((f) => (
              <li key={f.id} className={styles.card}>
                {localizedName(f.payload, language, capitalize(f.name.replace(/-/g, ' ')))}
                {!f.cached && <span className={styles.notCached}> — {t('ficha.notCachedForm')}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
      </div>
    </section>
  )
}
