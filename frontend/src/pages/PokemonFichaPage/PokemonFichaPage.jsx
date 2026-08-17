import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import usePokemonFicha from '../../hooks/usePokemonFicha.js'
import useFichaSection from '../../hooks/useFichaSection.js'
import useImageFallback from '../../hooks/useImageFallback.js'
import useAnimatedSpriteVariants from '../../hooks/useAnimatedSpriteVariants.js'
import useSelectedVersion from '../../hooks/useSelectedVersion.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import TypeBadge from '../../components/TypeBadge/TypeBadge.jsx'
import PokemonHeroSprite from '../../components/PokemonHeroSprite/PokemonHeroSprite.jsx'
import StatRadarChart, { MAX_STAT, STAT_LABELS, STAT_ORDER } from '../../components/StatRadarChart/StatRadarChart.jsx'
import { typeColor } from '../../utils/pokemonTypes.js'
import { spriteHomeUrl } from '../../utils/spritesHome.js'
import {
  animatedSpriteUrl,
  femaleAnimatedSpriteUrl,
  femaleShinyAnimatedSpriteUrl,
  shinyAnimatedSpriteUrl,
} from '../../utils/animatedSprite.js'
import { capitalize, formatPokedexNumber } from '../../utils/pokemonFormat.js'
import { localizedName } from '../../utils/pokeApiLocalization.js'
import { gameCoverUrl } from '../../utils/gameCovers.js'
import { itemIconUrl } from '../../utils/itemSprite.js'
import { compareValues } from '../../utils/sorting.js'
import {
  FICHA_SECTIONS,
  damageClassIconUrl,
  damageClassName,
  evolutionStages,
  flavorTextsByVersion,
  genusForLanguage,
  generationNumber,
  latestVersionedText,
  moveLearnMethod,
  moveLearnMethodName,
  sectionMissingCount,
  speciesDisplayName,
  totalMissing,
} from '../../utils/pokemonFicha.js'
import styles from './PokemonFichaPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

const sectionLabel = Object.fromEntries(FICHA_SECTIONS.map(({ key, label }) => [key, label]))

// Ver comentario sobre sectionRefs/scrollToSection en el componente: en escritorio da
// igual (todas visibles), en móvil solo la sección activa queda sin este class extra.
const sectionClassName = (styles, key, activeSection) =>
  key === activeSection ? styles.sectionBlock : `${styles.sectionBlock} ${styles.sectionInactiveMobile}`

const collapseWrapClassName = (styles, key, collapsedSections) =>
  collapsedSections.has(key) ? `${styles.collapseWrap} ${styles.collapseWrapClosed}` : styles.collapseWrap

// Catálogo interno indexado por clave (mismo criterio que SORTS en usePokemonBrowser)
// para las columnas ordenables de la tabla de movimientos. 'level' ordena por método
// de aprendizaje primero (mismo orden que LEARN_METHOD_PRIORITY en pokemonFicha.js:
// nivel, MT/MO, tutor, cría) y por nivel dentro del grupo "Nivel" — el orden "por
// defecto" que pidió David, no el orden alfabético ni el de llegada del array.
const LEARN_METHOD_SORT_RANK = { 'level-up': 0, machine: 1, tutor: 2, egg: 3 }
const MOVE_SORTS = {
  level: {
    labelKey: 'ficha.moveLevel',
    value: (m) => (LEARN_METHOD_SORT_RANK[m.learnMethod] ?? 9) * 1000 + (m.level ?? 0),
  },
  name: { labelKey: 'ficha.colMove', value: (m) => m.displayName },
  type: { labelKey: 'ficha.colType', value: (m) => m.type },
  damageClass: { labelKey: 'ficha.colClass', value: (m) => m.damageClass },
  power: { labelKey: 'ficha.movePower', value: (m) => (m.cached ? m.payload.power : null) },
  pp: { labelKey: 'ficha.movePP', value: (m) => (m.cached ? m.payload.pp : null) },
  accuracy: { labelKey: 'ficha.moveAccuracy', value: (m) => (m.cached ? m.payload.accuracy : null) },
}

// Cabecera clicable de cada sección — colapsa/expande con animación (ver
// .collapseWrap en el CSS, truco de grid-template-rows 1fr/0fr en vez de max-height a
// mano). Componente aparte porque se repite igual en las 7 secciones.
function SectionHeading({ label, sectionKey, collapsed, onToggle, color }) {
  const isCollapsed = collapsed.has(sectionKey)
  return (
    <button
      type="button"
      className={styles.sectionHeadingRow}
      onClick={() => onToggle(sectionKey)}
      aria-expanded={!isCollapsed}
    >
      <h2 className={styles.sectionHeading} style={{ color, borderColor: color }}>
        {label}
      </h2>
      <span
        className={isCollapsed ? `${styles.collapseChevron} ${styles.collapseChevronClosed}` : styles.collapseChevron}
        style={{ color }}
      >
        ▾
      </span>
    </button>
  )
}

export default function PokemonFichaPage() {
  const { idOrName } = useParams()
  const { status, ficha, error, caching, cacheMissing } = usePokemonFicha(idOrName)
  const { section, setSection } = useFichaSection('DESC')
  const { version: selectedVersion, setVersion } = useSelectedVersion()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const pokemonNames = usePokemonNames()
  const [expandedMoves, setExpandedMoves] = useState(() => new Set())
  const [moveSortKey, setMoveSortKey] = useState('level')
  const [moveSortDirection, setMoveSortDirection] = useState('asc')
  const toggleMoveSort = (key) => {
    if (key === moveSortKey) {
      setMoveSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setMoveSortKey(key)
      setMoveSortDirection('asc')
    }
  }
  // Todas colapsadas al abrir la ficha (pedido explícito de David) — se reinicia al
  // navegar a otra ficha (evolución), no solo en la primera carga de la app.
  const [collapsedSections, setCollapsedSections] = useState(() => new Set(FICHA_SECTIONS.map((s) => s.key)))
  useEffect(() => {
    setCollapsedSections(new Set(FICHA_SECTIONS.map((s) => s.key)))
  }, [idOrName])
  const toggleCollapse = (key) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const expandSection = (key) =>
    setCollapsedSections((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
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
  const [showFemale, setShowFemale] = useState(false)
  const [showShiny, setShowShiny] = useState(false)
  // Alcremie (y cualquier especie con el mismo patrón en PokeAPI: una única `pokemon`
  // con varias `pokemon.forms` cosméticas colgando de ella, ver animatedSprite.js) no
  // tiene esas decoraciones en `species.varieties` — así que no aparecen como cards en
  // la pestaña Formas, se eligen aquí para el sprite animado del banner.
  const [decorationForm, setDecorationForm] = useState(null)
  useEffect(() => {
    setShowFemale(false)
    setShowShiny(false)
    setDecorationForm(null)
  }, [pokemon?.name])
  const activeSpriteName = decorationForm ?? pokemon?.name
  const { hasFemale, hasShiny, hasFemaleShiny } = useAnimatedSpriteVariants(activeSpriteName)

  // En escritorio, las 7 secciones se renderizan siempre, apiladas — las pestañas de
  // arriba son anclas que hacen scroll (no interruptores de mostrar/ocultar). En
  // móvil se mantiene el comportamiento de antes (una sección visible a la vez, ver
  // .sectionInactiveMobile en el CSS): ahí sí tiene sentido por espacio de pantalla,
  // como razonó David al pedir este cambio — ver
  // .claude/memory/project_pokewebmax_progress.md.
  const sectionRefs = useRef({})
  const scrollToSection = (key) => {
    setSection(key)
    expandSection(key)
    if (window.matchMedia('(min-width: 901px)').matches) {
      // Un frame para dar tiempo a que el colapso se expanda antes de calcular el
      // scroll — si estaba colapsada, scrollIntoView con la sección todavía a 0fr de
      // alto apuntaría al sitio equivocado.
      requestAnimationFrame(() => {
        sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  useEffect(() => {
    if (!ficha) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setSection(entry.target.dataset.sectionKey)
        }
      },
      // Banda de activación: justo debajo de las dos barras fijas (nav de la app +
      // anclas de la ficha) hasta el 70% superior del viewport — evita que una
      // sección larga entera cuente como "activa" solo por asomar un píxel abajo.
      { rootMargin: '-135px 0px -70% 0px', threshold: 0 },
    )
    for (const el of Object.values(sectionRefs.current)) {
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha])

  // La animación de crecimiento (StatRadarChart/.statBarFill) se dispara cada vez que
  // la sección STATS está visible Y expandida — no es un state propio, es derivado de
  // esas dos señales, así que se reinicia sola al salir de vista por scroll o al
  // colapsar la sección (pedido explícito de David), sin lógica extra.
  const [statsInView, setStatsInView] = useState(false)
  useEffect(() => {
    const el = sectionRefs.current.STATS
    if (!el) return undefined
    const observer = new IntersectionObserver(([entry]) => setStatsInView(entry.isIntersecting), {
      threshold: 0.15,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ficha])
  const statsAnimated = statsInView && !collapsedSections.has('STATS')

  if (status === 'loading') return <p className={styles.status}>{t('ficha.loading')}</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!ficha?.pokemon) return null

  const { species, evolutionChain, moves, abilities, forms, missing, wikidexFlavorText } = ficha
  const types = pokemon.types.map((t) => t.type.name)
  const primaryColor = typeColor(types[0])
  const secondaryColor = typeColor(types[1] ?? types[0])
  const missingTotal = totalMissing(missing)
  const generation = generationNumber(species)

  const versions = flavorTextsByVersion(species, language, wikidexFlavorText)
  const activeVersion = versions.find((v) => v.version === selectedVersion) ?? versions[0]
  const displayName = speciesDisplayName(species, language, capitalize(pokemon.name))

  // Las formas Gigamax no tienen género ni shiny en el material descargado (ver
  // animatedSpriteUrl) — se oculta el toggle en vez de dejarlo apuntar a una
  // combinación que no existe.
  const isGigantamax = pokemon.name.endsWith('-gmax')

  // Especies como Frillish/Jellicent/Pyroar modelan el dimorfismo como
  // `pokemon.forms: [x-male, x-female]` de un único `pokemon` — mismo patrón de datos
  // que Alcremie/Unown, pero esto YA lo cubre el toggle ♂/♀ de arriba (hasFemale via
  // useAnimatedSpriteVariants), así que no se ofrece también como selector de
  // decoración: sería un segundo control para elegir lo mismo.
  const isMaleFemaleFormPair =
    pokemon.forms.length === 2 && pokemon.forms.every((f) => f.name.endsWith('-male') || f.name.endsWith('-female'))
  const hasDecorationForms = pokemon.forms.length > 1 && !isMaleFemaleFormPair

  // El toggle shiny refleja la intención del usuario, no la disponibilidad exacta para
  // el género activo — si esa combinación en concreto no está en el pack (ver
  // useAnimatedSpriteVariants), se cae al shiny normal en vez de perder la animación
  // entera, sin apagar el botón.
  const showShinyGender = showShiny && (showFemale ? hasFemaleShiny : hasShiny)
  const animatedPokemonSrc = showFemale
    ? showShinyGender
      ? femaleShinyAnimatedSpriteUrl(activeSpriteName)
      : femaleAnimatedSpriteUrl(activeSpriteName)
    : showShinyGender
      ? shinyAnimatedSpriteUrl(activeSpriteName)
      : animatedSpriteUrl(activeSpriteName)

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
              animatedSrc={animatedPokemonSrc}
              staticSrc={heroImage.src}
              staticOnError={heroImage.onError}
              alt={pokemon.name}
              width={200}
              height={200}
            />
          </div>
          {!isGigantamax && hasFemale && (
            <div className={styles.genderToggle} role="group" aria-label={t('ficha.genderToggleAria')}>
              <button
                type="button"
                className={!showFemale ? `${styles.genderButton} ${styles.genderButtonActive}` : styles.genderButton}
                onClick={() => setShowFemale(false)}
                aria-label={t('ficha.genderMale')}
              >
                ♂
              </button>
              <button
                type="button"
                className={showFemale ? `${styles.genderButton} ${styles.genderButtonActive}` : styles.genderButton}
                onClick={() => setShowFemale(true)}
                aria-label={t('ficha.genderFemale')}
              >
                ♀
              </button>
            </div>
          )}
          {!isGigantamax && (hasShiny || hasFemaleShiny) && (
            <div className={styles.shinyToggle} role="group" aria-label={t('ficha.shinyToggleAria')}>
              <button
                type="button"
                className={!showShiny ? `${styles.shinyButton} ${styles.shinyButtonActive}` : styles.shinyButton}
                onClick={() => setShowShiny(false)}
                aria-label={t('ficha.shinyOff')}
              >
                ☆
              </button>
              <button
                type="button"
                className={showShiny ? `${styles.shinyButton} ${styles.shinyButtonActive}` : styles.shinyButton}
                onClick={() => setShowShiny(true)}
                aria-label={t('ficha.shinyOn')}
              >
                ★
              </button>
            </div>
          )}
          {hasDecorationForms && (
            <select
              className={styles.decorationSelect}
              value={decorationForm ?? pokemon.forms[0].name}
              onChange={(e) => setDecorationForm(e.target.value)}
              aria-label={t('ficha.decorationAria')}
            >
              {pokemon.forms.map((f) => (
                <option key={f.name} value={f.name}>
                  {capitalize(f.name.replace(`${pokemon.name}-`, '').replace(/-/g, ' '))}
                </option>
              ))}
            </select>
          )}
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
        <Link to="/" className={styles.backLink}>
          ← {t('ficha.backToList')}
        </Link>
        <div className={styles.tabPills}>
          {FICHA_SECTIONS.map(({ key, label, missingKey }) => {
            const count = sectionMissingCount(missing, missingKey)
            const active = section === key
            return (
              <button
                key={key}
                type="button"
                className={styles.tab}
                style={active ? { background: primaryColor, color: '#fff' } : undefined}
                onClick={() => scrollToSection(key)}
              >
                {label[language]}
                {count > 0 && <span className={styles.badge}>{count}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      <div className={styles.content}>
        <section
          id="ficha-DESC"
          ref={(el) => (sectionRefs.current.DESC = el)}
          data-section-key="DESC"
          className={sectionClassName(styles, 'DESC', section)}
        >
          <SectionHeading label={sectionLabel.DESC[language]} sectionKey="DESC" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'DESC', collapsedSections)}>
          <div className={styles.collapseInner}>
            {versions.length > 0 ? (
              <>
                <div className={styles.versionPicker}>
                  {versions.map((v) => {
                    const active = v.version === activeVersion?.version
                    const cover = gameCoverUrl(v.version)
                    const versionLabel = capitalize(v.version.replace(/-/g, ' '))

                    if (cover) {
                      return (
                        <button
                          key={v.version}
                          type="button"
                          className={active ? `${styles.versionCover} ${styles.versionCoverActive}` : styles.versionCover}
                          style={active ? { borderColor: primaryColor, boxShadow: `0 0 0 3px ${primaryColor}4d` } : undefined}
                          onClick={() => setVersion(v.version)}
                          title={versionLabel}
                        >
                          <img src={cover} alt={versionLabel} />
                          {!v.translated && <span className={styles.versionCoverTag}>EN</span>}
                        </button>
                      )
                    }

                    return (
                      <button
                        key={v.version}
                        type="button"
                        className={active ? `${styles.versionChip} ${styles.versionChipActive}` : styles.versionChip}
                        style={active ? { background: primaryColor, borderColor: primaryColor, color: '#fff' } : undefined}
                        onClick={() => setVersion(v.version)}
                      >
                        {versionLabel}
                        {!v.translated && <span className={styles.tag}>EN</span>}
                      </button>
                    )
                  })}
                </div>

                <div className={styles.descPanel} style={{ '--desc-accent': primaryColor }}>
                  <div className={styles.descPanelHeader}>
                    <span className={styles.descLed} />
                    <span>{t('ficha.descEntry')}</span>
                    <span className={styles.descPanelVersion}>
                      {capitalize(activeVersion.version.replace(/-/g, ' '))}
                    </span>
                  </div>
                  <p className={styles.quote} key={activeVersion.version}>
                    {activeVersion.text}
                    <span className={styles.cursor} aria-hidden="true" />
                  </p>
                  {!activeVersion.translated && (
                    <span className={styles.notTranslated}>{t('ficha.notTranslated')}</span>
                  )}
                </div>
              </>
            ) : (
              <p>{t('ficha.descriptionUnavailable')}</p>
            )}
          </div>
          </div>
        </section>

        <section
          id="ficha-EVOS"
          ref={(el) => (sectionRefs.current.EVOS = el)}
          data-section-key="EVOS"
          className={sectionClassName(styles, 'EVOS', section)}
        >
          <SectionHeading label={sectionLabel.EVOS[language]} sectionKey="EVOS" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'EVOS', collapsedSections)}>
          <div className={styles.collapseInner}>
          {evolutionChain ? (
            <div className={styles.evoList}>
              {evolutionStages(evolutionChain, t).map((stage, i) => {
                const stageTypes = pokemonNames[stage.id]?.types ?? []
                const evoColor1 = stageTypes.length > 0 ? typeColor(stageTypes[0]) : '#9c9c9c'
                const evoColor2 = stageTypes.length > 0 ? typeColor(stageTypes[1] ?? stageTypes[0]) : '#7a7a7a'
                return (
                  <Fragment key={stage.id}>
                    {i > 0 && (
                      <div className={styles.evoConnector}>
                        {stage.method?.item && (
                          <Link to={`/objetos/${stage.method.item.name}`} className={styles.evoMethodItem}>
                            <img src={itemIconUrl(stage.method.item.name)} alt="" width={28} height={28} />
                          </Link>
                        )}
                        {stage.method?.text}
                      </div>
                    )}
                    <Link
                      to={`/ficha/${stage.id}`}
                      className={styles.evoCard}
                      style={{ background: `linear-gradient(90deg, ${evoColor1} 0%, ${evoColor2} 100%)` }}
                    >
                      <img
                        className={styles.evoSprite}
                        src={spriteHomeUrl(stage.id) ?? officialArtworkUrl(stage.id)}
                        alt={stage.name}
                        width={64}
                        height={64}
                      />
                      <div>
                        <strong>{pokemonNames[stage.id]?.names[language] ?? capitalize(stage.name)}</strong>
                        <span className={styles.evoNumber}>{formatPokedexNumber(stage.id)}</span>
                      </div>
                    </Link>
                  </Fragment>
                )
              })}
            </div>
          ) : (
            <p>{t('ficha.evoChainMissing')}</p>
          )}
          </div>
          </div>
        </section>

        <section
          id="ficha-STATS"
          ref={(el) => (sectionRefs.current.STATS = el)}
          data-section-key="STATS"
          className={sectionClassName(styles, 'STATS', section)}
        >
          <SectionHeading label={sectionLabel.STATS[language]} sectionKey="STATS" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'STATS', collapsedSections)}>
          <div className={styles.collapseInner}>
          <div className={styles.statsPanel}>
            <StatRadarChart stats={pokemon.stats} color={primaryColor} animate={statsAnimated} />
            <div className={styles.statBars}>
              {STAT_ORDER.map((name) => {
                const value = pokemon.stats.find((s) => s.stat.name === name)?.base_stat ?? 0
                const percent = Math.min((value / MAX_STAT) * 100, 100)
                return (
                  <div key={name} className={styles.statBarRow}>
                    <span className={styles.statBarLabel}>{STAT_LABELS[name]}</span>
                    <div className={styles.statBarTrack}>
                      <div
                        className={styles.statBarFill}
                        style={{ width: `${statsAnimated ? percent : 0}%`, background: primaryColor }}
                      />
                    </div>
                    <span className={styles.statBarValue}>{value}</span>
                  </div>
                )
              })}
              <p className={styles.statsTotal}>
                {t('ficha.statsTotal')} <strong>{pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0)}</strong>
              </p>
            </div>
          </div>
          </div>
          </div>
        </section>

        <section
          id="ficha-ABILITY"
          ref={(el) => (sectionRefs.current.ABILITY = el)}
          data-section-key="ABILITY"
          className={sectionClassName(styles, 'ABILITY', section)}
        >
          <SectionHeading label={sectionLabel.ABILITY[language]} sectionKey="ABILITY" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'ABILITY', collapsedSections)}>
          <div className={styles.collapseInner}>
          <ul className={styles.cardList}>
            {abilities.map((a) => {
              const hidden = pokemon.abilities.find((slot) => slot.ability.name === a.name)?.is_hidden
              const { text: effect, translated } = latestVersionedText(
                a.payload?.flavor_text_entries,
                language,
                'flavor_text',
                ficha.wikidexEffectText?.ability?.[a.id],
              )
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
          </div>
          </div>
        </section>

        <section
          id="ficha-MOVES"
          ref={(el) => (sectionRefs.current.MOVES = el)}
          data-section-key="MOVES"
          className={sectionClassName(styles, 'MOVES', section)}
        >
          <SectionHeading label={sectionLabel.MOVES[language]} sectionKey="MOVES" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'MOVES', collapsedSections)}>
          <div className={styles.collapseInner}>
          <div className={styles.moveTableWrap}>
          <table className={styles.moveTable}>
            <thead>
              <tr>
                {Object.entries(MOVE_SORTS).map(([key, { labelKey }]) => (
                  <th key={key}>
                    <button type="button" className={styles.moveSortButton} onClick={() => toggleMoveSort(key)}>
                      {t(labelKey)}
                      {moveSortKey === key && <span>{moveSortDirection === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves
                .map((m) => {
                  const { method, level } = moveLearnMethod(pokemon.moves, m.name)
                  return {
                    ...m,
                    learnMethod: method,
                    level,
                    displayName: localizedName(m.payload, language, capitalize(m.name.replace(/-/g, ' '))),
                    type: m.payload?.type.name ?? '',
                    damageClass: m.payload?.damage_class.name ?? '',
                  }
                })
                .sort((a, b) => compareValues(MOVE_SORTS[moveSortKey].value(a), MOVE_SORTS[moveSortKey].value(b), moveSortDirection))
                .map((m) => {
                  const expanded = expandedMoves.has(m.id)
                  const { text: description, translated } = latestVersionedText(
                    m.payload?.flavor_text_entries,
                    language,
                    'flavor_text',
                    ficha.wikidexEffectText?.move?.[m.id],
                  )

                  return (
                    <Fragment key={m.id}>
                      <tr
                        className={m.cached ? styles.moveRowClickable : undefined}
                        onClick={m.cached ? () => toggleMove(m.id) : undefined}
                        role={m.cached ? 'button' : undefined}
                        tabIndex={m.cached ? 0 : undefined}
                        aria-expanded={m.cached ? expanded : undefined}
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
                        <td className={styles.moveLevelCell}>
                          {m.learnMethod === 'level-up'
                            ? `${moveLearnMethodName(m.learnMethod, language)} ${m.level ?? ''}`
                            : moveLearnMethodName(m.learnMethod, language)}
                        </td>
                        <td>{m.displayName}</td>
                        <td>{m.payload && <TypeBadge type={m.type} />}</td>
                        <td>
                          {m.payload && (
                            <span className={styles.moveClassCell}>
                              <img className={styles.damageClassIcon} src={damageClassIconUrl(m.damageClass)} alt="" />
                              {damageClassName(m.damageClass, language)}
                            </span>
                          )}
                        </td>
                        <td>{m.cached ? (m.payload.power ?? '-') : '-'}</td>
                        <td>{m.cached ? (m.payload.pp ?? '-') : '-'}</td>
                        <td>{m.cached ? (m.payload.accuracy != null ? `${m.payload.accuracy}%` : '-') : '-'}</td>
                      </tr>
                      {!m.cached && (
                        <tr>
                          <td colSpan={7} className={styles.notCached}>
                            {t('ficha.notCachedMove')}
                          </td>
                        </tr>
                      )}
                      {m.cached && (
                        <tr>
                          <td colSpan={7} className={styles.moveDescriptionCell}>
                            <div className={expanded ? styles.collapseWrap : `${styles.collapseWrap} ${styles.collapseWrapClosed}`}>
                              <div className={styles.collapseInner}>
                                <p className={styles.moveDescription}>
                                  {description ?? t('ficha.noDescription')}
                                  {description && !translated && <span className={styles.tag}> EN</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
            </tbody>
          </table>
          </div>
          </div>
          </div>
        </section>

        <section
          id="ficha-INFO"
          ref={(el) => (sectionRefs.current.INFO = el)}
          data-section-key="INFO"
          className={sectionClassName(styles, 'INFO', section)}
        >
          <SectionHeading label={sectionLabel.INFO[language]} sectionKey="INFO" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'INFO', collapsedSections)}>
          <div className={styles.collapseInner}>
          {species ? (
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
          )}
          </div>
          </div>
        </section>

        <section
          id="ficha-FORM"
          ref={(el) => (sectionRefs.current.FORM = el)}
          data-section-key="FORM"
          className={sectionClassName(styles, 'FORM', section)}
        >
          <SectionHeading label={sectionLabel.FORM[language]} sectionKey="FORM" collapsed={collapsedSections} onToggle={toggleCollapse} color={primaryColor} />
          <div className={collapseWrapClassName(styles, 'FORM', collapsedSections)}>
          <div className={styles.collapseInner}>
          <ul className={styles.cardList}>
            {forms.map((f) => {
              const sprite = f.payload?.sprites?.front_default
              // f.payload es el recurso `pokemon` de esta variedad (no `pokemon-form`
              // — ver comentario en PokemonFichaAssembler), así que trae tipos reales
              // pero no `names` localizados; el nombre cae al slug formateado.
              const formTypes = f.payload?.types?.map((t) => t.type.name) ?? []
              const [formColor1, formColor2] =
                formTypes.length > 0
                  ? [typeColor(formTypes[0]), typeColor(formTypes[1] ?? formTypes[0])]
                  : [primaryColor, secondaryColor]
              const cardContent = (
                <>
                  {sprite ? (
                    <img className={styles.formSprite} src={sprite} alt="" width={56} height={56} />
                  ) : (
                    <div className={styles.formSprite} />
                  )}
                  <div>
                    <strong>{capitalize(f.name.replace(/-/g, ' '))}</strong>
                    {!f.cached && <span className={styles.formNotCached}>{t('ficha.notCachedForm')}</span>}
                  </div>
                </>
              )
              const style = { background: `linear-gradient(90deg, ${formColor1} 0%, ${formColor2} 100%)` }

              return (
                <li key={f.id} className={styles.formCard} style={style}>
                  {f.cached && f.id !== pokemon.id ? (
                    <Link to={`/ficha/${f.id}`} className={styles.formCardInner}>
                      {cardContent}
                    </Link>
                  ) : (
                    <div className={styles.formCardInner}>{cardContent}</div>
                  )}
                </li>
              )
            })}
          </ul>
          </div>
          </div>
        </section>
      </div>
      </div>
      </div>
    </section>
  )
}
