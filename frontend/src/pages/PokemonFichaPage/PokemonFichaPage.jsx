import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import usePokemonFicha from '../../hooks/usePokemonFicha.js'
import useFichaSection from '../../hooks/useFichaSection.js'
import useImageFallback from '../../hooks/useImageFallback.js'
import useAnimatedSpriteVariants from '../../hooks/useAnimatedSpriteVariants.js'
import useSelectedVersion from '../../hooks/useSelectedVersion.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import useItemNames from '../../hooks/useItemNames.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import TypeBadge from '../../components/TypeBadge/TypeBadge.jsx'
import PokemonHeroSprite from '../../components/PokemonHeroSprite/PokemonHeroSprite.jsx'
import StatRadarChart, { MAX_STAT, STAT_LABELS, STAT_ORDER } from '../../components/StatRadarChart/StatRadarChart.jsx'
import { typeColor, typeIconUrl } from '../../utils/pokemonTypes.js'
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
  LEGACY_STAT_LABELS,
  damageClassIconUrl,
  damageClassName,
  evolutionStages,
  flavorTextsByVersion,
  genusForLanguage,
  generationNumber,
  latestVersionedText,
  moveLearnMethod,
  moveLearnMethodName,
  movesForVersionGroup,
  resolveHistoricalStats,
  resolvePastBySlot,
  resolvePastTypes,
  sectionMissingCount,
  speciesDisplayName,
  totalMissing,
} from '../../utils/pokemonFicha.js'
import styles from './PokemonFichaPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

const sectionLabel = Object.fromEntries(FICHA_SECTIONS.map(({ key, label }) => [key, label]))

// Un icono por pestaña/sección — puramente decorativo (currentColor, hereda el color de
// tipo de la sección), no necesita ser un componente aparte por lo simple que es.
const SECTION_ICONS = {
  DESC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  ),
  EVOS: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h11M12 5l7 7-7 7" />
    </svg>
  ),
  STATS: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  ),
  ABILITY: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4L12 3Z" />
      <path d="M19 15l.7 1.6L21 17l-1.9.9-.7 1.6-.7-1.6L16 17l1.9-.9.7-1.6Z" />
    </svg>
  ),
  MOVES: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
      <path d="M4 4l3 1M20 4l-3 1M4 20l3-1M20 20l-3-1" />
    </svg>
  ),
  INFO: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  ),
  FORM: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </svg>
  ),
}

// Ver comentario sobre sectionRefs/scrollToSection en el componente: en escritorio da
// igual (todas visibles), en móvil solo la sección activa queda sin este class extra.
const sectionClassName = (styles, key, activeSection) =>
  key === activeSection ? styles.sectionBlock : `${styles.sectionBlock} ${styles.sectionInactiveMobile}`

// Solo una sección puede estar abierta a la vez (pedido explícito de David) — openSection
// es la clave abierta o null, en vez de un Set de colapsadas.
const collapseWrapClassName = (styles, key, openSection) =>
  key === openSection ? styles.collapseWrap : `${styles.collapseWrap} ${styles.collapseWrapClosed}`

// Debe coincidir con la duración de transition de .collapseWrap en el CSS — ver
// comentario de scrollSectionIntoView.
const COLLAPSE_TRANSITION_MS = 250

// Al abrir una sección (clic en su propia cabecera o en una pestaña de arriba, ver
// toggleCollapse/expandSection), el scroll INTERNO de .content se mueve para dejar su
// cabecera arriba del todo — pedido explícito de David, sustituye al reordenamiento
// visual (mover la sección al principio) que había antes.
//
// Un solo requestAnimationFrame no basta: si YA había otra sección abierta, abrir
// esta cierra aquella (acordeón de una sola), y su colapso anima
// `grid-template-rows` durante 250ms (.collapseWrap) — eso desplaza hacia arriba
// todo lo que esté debajo mientras se encoge. Calcular el scroll en el frame
// siguiente capturaba la posición ANTES de que ese desplazamiento terminara, así que
// el resultado quedaba corto y hacía falta un segundo clic (con nada más animando ya)
// para que acertara. Se espera a que la transición termine del todo en vez de un
// único frame.
//
// Solo en escritorio: en móvil el scroll no es interno a .content (ver mobile
// override en el CSS), es la página entera, y las secciones se muestran/ocultan por
// completo en vez de apilarse.
function scrollSectionIntoView(sectionRefs, key) {
  if (!window.matchMedia('(min-width: 901px)').matches) return
  setTimeout(() => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, COLLAPSE_TRANSITION_MS + 20)
}

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
function SectionHeading({ label, sectionKey, openSection, onToggle, color, icon, preview }) {
  const isCollapsed = sectionKey !== openSection
  return (
    <button
      type="button"
      className={styles.sectionHeadingRow}
      onClick={() => onToggle(sectionKey)}
      aria-expanded={!isCollapsed}
    >
      <span className={styles.sectionHeadingMain} style={{ color }}>
        <span className={styles.sectionIconChip}>{icon}</span>
        <span className={styles.sectionHeadingText}>
          <h2 className={styles.sectionHeading}>{label}</h2>
          {preview && <span className={styles.sectionPreview}>{preview}</span>}
        </span>
      </span>
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
  const itemNames = useItemNames()
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
  // navegar a otra ficha (evolución), no solo en la primera carga de la app. Solo una
  // sección puede estar abierta a la vez (pedido explícito de David) — openSection es
  // la clave abierta o null, en vez de un Set de colapsadas donde varias podían estarlo
  // a la vez.
  const [openSection, setOpenSection] = useState(null)
  useEffect(() => {
    setOpenSection(null)
  }, [idOrName])
  // sectionRefs se declara aquí (antes de usarlo) porque scrollToSection más abajo lo
  // necesita — ver comentario junto a los <section> del JSX sobre por qué se
  // renderizan siempre las 7 en vez de condicionalmente.
  const sectionRefs = useRef({})
  const toggleCollapse = (key) => {
    const opening = openSection !== key
    setOpenSection((prev) => (prev === key ? null : key))
    if (opening) scrollSectionIntoView(sectionRefs, key)
  }
  const expandSection = (key) => {
    setOpenSection(key)
    scrollSectionIntoView(sectionRefs, key)
  }
  // La cabecera sticky de la tabla de movimientos (`.moveTable th`, CSS) solo puede
  // pegarse a `.content` (la única caja que hace scroll interno) si nada intermedio
  // tiene su propio overflow no-visible — pero `.collapseInner` SÍ necesita
  // overflow:hidden mientras la sección anima (ver comentario de `.collapseWrap`), o
  // el contenido se vería desbordar durante los 250ms de apertura/cierre. Se retira
  // ese overflow:hidden (clase `.collapseInnerSticky`, ver CSS) solo una vez terminada
  // la animación de apertura y solo mientras MOVES sea la sección abierta — mismo
  // tiempo que COLLAPSE_TRANSITION_MS/scrollSectionIntoView.
  const [movesSettled, setMovesSettled] = useState(false)
  useEffect(() => {
    if (openSection !== 'MOVES') {
      setMovesSettled(false)
      return
    }
    const id = setTimeout(() => setMovesSettled(true), COLLAPSE_TRANSITION_MS + 20)
    return () => clearTimeout(id)
  }, [openSection])
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
  // .claude/memory/project_pokewebmax_progress.md. (sectionRefs se declaró más arriba,
  // lo necesita también el hook de FLIP del reordenamiento animado.)
  const scrollToSection = (key) => {
    setSection(key)
    expandSection(key) // ya incluye el scroll interno hacia su cabecera, ver arriba
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
  const statsAnimated = statsInView && openSection === 'STATS'

  if (status === 'loading') return <p className={styles.status}>{t('ficha.loading')}</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!ficha?.pokemon) return null

  const { species, evolutionChain, moves, abilities, forms, missing, wikidexFlavorText, wikidexVarietyFlavorText, versionMeta } = ficha

  // Selector único de juego (ver globalVersionPicker más abajo, antes vivía solo
  // dentro de DESC): resuelve el `version` elegido a `version_group`/`generation` con
  // el `versionMeta` que ya manda el backend (PokemonFichaAssembler) para poder
  // filtrar EVOS/MOVES por juego y STATS/ABILITY/tipos por generación. Sin selección
  // (selectedVersion null, estado inicial), todo lo de abajo se queda en `null` y cada
  // función de pokemonFicha.js cae a su comportamiento por defecto de siempre.
  const activeMeta = selectedVersion ? versionMeta?.[selectedVersion] : null
  const activeVersionGroup = activeMeta?.versionGroup ?? null
  const activeGeneration = activeMeta?.generation ?? null

  const types = resolvePastTypes(pokemon, activeGeneration).map((t) => t.type.name)
  const primaryColor = typeColor(types[0])
  const secondaryColor = typeColor(types[1] ?? types[0])
  const missingTotal = totalMissing(missing)
  const generation = generationNumber(species)

  // `versions` (con texto) alimenta solo el panel de DESC — `allVersionNames` (de
  // versionMeta, ver backend) es la lista real de juegos a ofrecer en el selector
  // global: se comprobó con datos reales que muchos Pokémon "veteranos" no tienen
  // flavor_text_entries en juegos recientes (ej. Pikachu sin texto de Escarlata/
  // Púrpura pese a estar confirmado en la Pokédex de Paldea, nº 74) — versionMeta ya
  // resuelve esto con pokedex_numbers en vez de solo con el texto. Si se elige un
  // juego sin texto propio, `versions.find` no lo encuentra y DESC debe decirlo (no
  // caer al texto de OTRO juego): el fallback a `versions[0]` solo aplica cuando
  // todavía no se ha elegido nada.
  const versions = flavorTextsByVersion(species, language, wikidexFlavorText)
  const allVersionNames = Object.keys(versionMeta ?? {})
  const activeVersion = selectedVersion ? versions.find((v) => v.version === selectedVersion) : versions[0]
  // Qué chip resaltar en el selector: el juego elegido, o el más antiguo con
  // descripción como valor por defecto (mismo criterio visual que ya tenía DESC antes
  // de este selector) — independiente de `activeVersion`, que ahora puede quedarse
  // `undefined` a propósito cuando el juego elegido no tiene texto.
  const highlightedVersion = selectedVersion ?? versions[0]?.version
  const displayName = speciesDisplayName(species, language, capitalize(pokemon.name))

  // Hoisted fuera del JSX de la sección EVOS para poder reusarlo también como subtítulo
  // de la cabecera colapsada (ver sectionPreviews) sin recalcularlo dos veces.
  const evoStagesList = evolutionChain
    ? evolutionStages(evolutionChain, t, itemNames, language, activeVersionGroup)
    : []
  // Igual que evoStagesList: movimientos que de verdad se pueden aprender en el juego
  // elegido (sin selección, la lista completa de siempre) — se reusa tanto en la
  // preview de la pestaña como en la tabla de la sección.
  const scopedMoves = movesForVersionGroup(moves, pokemon.moves, activeVersionGroup)
  const { order: statOrder, stats: statsToShow } = resolveHistoricalStats(pokemon, activeGeneration)
  const statsTotal = statsToShow.reduce((sum, s) => sum + s.base_stat, 0)
  // Habilidades disponibles en el juego elegido (ver resolvePastBySlot en
  // pokemonFicha.js) — algunos slots concretos se sumaron más tarde que otros (ej. la
  // oculta, no antes de gen V): un slot que resuelve a `ability: null` para la
  // generación activa no está disponible todavía. `past_abilities` solo registra
  // CAMBIOS respecto al valor actual, así que un slot que nunca cambió (ej. el primero
  // de Clefairy) no aparece ahí y resolvePastBySlot lo deja tal cual — por eso antes de
  // gen III hace falta un corte aparte: la habilidad como mecánica de juego no existía
  // todavía, con independencia de qué diga el histórico de cada slot.
  const historicalAbilitySlots =
    activeGeneration != null && activeGeneration < 3
      ? []
      : resolvePastBySlot(pokemon.past_abilities, pokemon.abilities, activeGeneration, 'slot')
  const availableAbilityNames = new Set(
    historicalAbilitySlots.filter((slot) => slot.ability).map((slot) => slot.ability.name),
  )
  const scopedAbilities =
    activeGeneration == null ? abilities : abilities.filter((a) => availableAbilityNames.has(a.name))
  // Subtítulo de una línea bajo cada título de sección, visible tanto colapsada como
  // abierta — mitiga que la ficha se vea "vacía" con todo colapsado por defecto (ver
  // .claude/memory/project_pokewebmax_progress.md, decisión de David de colapsar todo
  // al abrir) sin tener que revertir esa decisión.
  const sectionPreviews = {
    DESC: versions.length > 0 ? t('ficha.previewVersions', { count: versions.length }) : null,
    EVOS: evoStagesList.length > 0 ? t('ficha.previewStages', { count: evoStagesList.length }) : null,
    STATS: t('ficha.previewStatsTotal', { value: statsTotal }),
    ABILITY: scopedAbilities.length > 0 ? t('ficha.previewAbilities', { count: scopedAbilities.length }) : null,
    MOVES: scopedMoves.length > 0 ? t('ficha.previewMoves', { count: scopedMoves.length }) : null,
    INFO: species ? t('ficha.previewBaseExp', { value: pokemon.base_experience ?? '—' }) : null,
    FORM: forms.length > 0 ? t('ficha.previewForms', { count: forms.length }) : null,
  }

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
          {/* Icono de tipo como marca de agua en la esquina de cada banda — mismo SVG
              que ya usa TypeBadge (fondo cuadrado del color exacto del tipo + glifo
              blanco), imitando la ficha de Dexter (Android): al coincidir el color de
              fondo del SVG con el de la propia banda, el cuadrado queda invisible y
              solo se ve el glifo, atenuado por la opacidad reducida. Solo se pinta el
              segundo (types[1]) si el Pokémon es de doble tipo — con un solo tipo
              ambas bandas comparten color y repetir el icono sería redundante. */}
          <img className={`${styles.heroTypeIcon} ${styles.heroTypeIconPrimary}`} src={typeIconUrl(types[0])} alt="" aria-hidden="true" />
          {types[1] && (
            <img className={`${styles.heroTypeIcon} ${styles.heroTypeIconSecondary}`} src={typeIconUrl(types[1])} alt="" aria-hidden="true" />
          )}
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
          <div className={styles.typesRow}>
            {types.map((typeName) => (
              <TypeBadge key={typeName} type={typeName} />
            ))}
          </div>
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

      {allVersionNames.length > 0 && (
        // Selector único de juego para TODA la ficha (antes vivía solo dentro de
        // DESC, condicionando únicamente el texto de la Pokédex; luego una fila
        // horizontal entre .tabs y .content) — pedido por David 2026-08-24: como
        // condiciona TODA la info de la ficha, pasa a ser su propia 3ª columna del
        // grid de .layout (mismo alto que .hero/.main vía el `stretch` ya establecido,
        // ver .layout más abajo), con scroll interno propio en vez de competir por
        // alto vertical con .content envolviendo en varias líneas. Mismos
        // versionCover/versionChip/gameCoverUrl de siempre, sin tocar su lógica —
        // recorre allVersionNames (de versionMeta/pokedex_numbers), no `versions` (de
        // flavor_text_entries) — hay juegos sin descripción propia todavía en PokeAPI
        // que igualmente deben poder elegirse aquí (ver comentario junto a `versions`
        // más arriba).
        <aside className={styles.globalVersionPicker}>
          <span className={styles.globalVersionLabel}>{t('ficha.gameSelectorLabel')}</span>
          <div className={styles.versionPicker}>
            {allVersionNames.map((versionName) => {
              const flavorEntry = versions.find((v) => v.version === versionName)
              const active = versionName === highlightedVersion
              const cover = gameCoverUrl(versionName)
              const versionLabel = capitalize(versionName.replace(/-/g, ' '))
              const showEnTag = flavorEntry != null && !flavorEntry.translated

              if (cover) {
                return (
                  <button
                    key={versionName}
                    type="button"
                    className={active ? `${styles.versionCover} ${styles.versionCoverActive}` : styles.versionCover}
                    style={active ? { borderColor: primaryColor, boxShadow: `0 0 0 3px ${primaryColor}4d` } : undefined}
                    onClick={() => setVersion(versionName)}
                    title={versionLabel}
                  >
                    <img src={cover} alt={versionLabel} />
                    {showEnTag && <span className={styles.versionCoverTag}>EN</span>}
                  </button>
                )
              }

              return (
                <button
                  key={versionName}
                  type="button"
                  className={active ? `${styles.versionChip} ${styles.versionChipActive}` : styles.versionChip}
                  style={active ? { background: primaryColor, borderColor: primaryColor, color: '#fff' } : undefined}
                  onClick={() => setVersion(versionName)}
                >
                  {versionLabel}
                  {showEnTag && <span className={styles.tag}>EN</span>}
                </button>
              )
            })}
          </div>
        </aside>
      )}

      <div className={styles.main}>
      <nav className={styles.tabs}>
        <Link to="/" className={styles.backLink}>
          ← {t('ficha.backToList')}
        </Link>
        <div className={styles.tabPills}>
          {FICHA_SECTIONS.map(({ key, label, missingKey }) => {
            const count = sectionMissingCount(missing, missingKey)
            // openSection, no el `section` del scrollspy: con el acordeón de una sola
            // sección + scroll-al-abrir, la pestaña resaltada debe reflejar cuál está
            // realmente desplegada, no cuál anda más cerca del borde superior del
            // scroll interno (eso derivaba hacia la sección siguiente en cuanto se
            // scrolleaba dentro de una sección larga, aunque siguiera siendo la
            // abierta). `section` se queda solo para la conmutación de vista en móvil.
            const active = openSection === key
            return (
              <button
                key={key}
                type="button"
                className={styles.tab}
                style={active ? { background: primaryColor, color: '#fff' } : undefined}
                onClick={() => scrollToSection(key)}
              >
                <span className={styles.tabIcon}>{SECTION_ICONS[key]}</span>
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
          <SectionHeading label={sectionLabel.DESC[language]} sectionKey="DESC" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.DESC} preview={sectionPreviews.DESC} />
          <div className={collapseWrapClassName(styles, 'DESC', openSection)}>
          <div className={styles.collapseInner}>
            {wikidexVarietyFlavorText ? (
              // Megaevolución/Gigamax: WikiDex tiene una descripción PROPIA de la
              // forma (aspecto, cómo cambia al transformarse...) que PokeAPI no tiene
              // en absoluto — comparte la de la especie base para todas sus variantes,
              // ver PokemonFichaAssembler. Pedida por David 2026-08-24: se prioriza
              // sobre la ficha por juego de abajo, que para estas formas solo
              // describiría al Pokémon base, no a la forma que se está viendo. No hay
              // variación por juego en este texto (WikiDex solo tiene una descripción
              // por forma), así que no se ata a `activeVersion`/al selector de juego.
              <div className={styles.descPanel} style={{ '--desc-accent': primaryColor }}>
                <div className={styles.descPanelHeader}>
                  <span className={styles.descLed} />
                  <span>{t('ficha.descEntry')}</span>
                  <span className={styles.descPanelVersion}>{t('ficha.descVarietySource')}</span>
                </div>
                <p className={styles.quote}>
                  {wikidexVarietyFlavorText}
                  <span className={styles.cursor} aria-hidden="true" />
                </p>
              </div>
            ) : activeVersion ? (
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
          <SectionHeading label={sectionLabel.EVOS[language]} sectionKey="EVOS" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.EVOS} preview={sectionPreviews.EVOS} />
          <div className={collapseWrapClassName(styles, 'EVOS', openSection)}>
          <div className={styles.collapseInner}>
          {evolutionChain ? (
            <div className={styles.evoList}>
              {evoStagesList.map((stage, i) => {
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
                      to={`/ficha/${stage.name ?? stage.id}`}
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
          <SectionHeading label={sectionLabel.STATS[language]} sectionKey="STATS" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.STATS} preview={sectionPreviews.STATS} />
          <div className={collapseWrapClassName(styles, 'STATS', openSection)}>
          <div className={styles.collapseInner}>
          <div className={styles.statsPanel}>
            <StatRadarChart
              stats={statsToShow}
              color={primaryColor}
              animate={statsAnimated}
              order={statOrder ?? undefined}
              labels={statOrder ? LEGACY_STAT_LABELS : undefined}
            />
            <div className={styles.statBars}>
              {(statOrder ?? STAT_ORDER).map((name) => {
                const value = statsToShow.find((s) => s.stat.name === name)?.base_stat ?? 0
                const percent = Math.min((value / MAX_STAT) * 100, 100)
                return (
                  <div key={name} className={styles.statBarRow}>
                    <span className={styles.statBarLabel}>{(statOrder ? LEGACY_STAT_LABELS : STAT_LABELS)[name]}</span>
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
                {t('ficha.statsTotal')} <strong>{statsTotal}</strong>
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
          <SectionHeading label={sectionLabel.ABILITY[language]} sectionKey="ABILITY" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.ABILITY} preview={sectionPreviews.ABILITY} />
          <div className={collapseWrapClassName(styles, 'ABILITY', openSection)}>
          <div className={styles.collapseInner}>
          {scopedAbilities.length === 0 ? (
            <p>{t('ficha.noAbilitiesInGame')}</p>
          ) : (
            <ul className={styles.cardList}>
              {scopedAbilities.map((a) => {
                const hidden = historicalAbilitySlots.find((slot) => slot.ability?.name === a.name)?.is_hidden
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
          )}
          </div>
          </div>
        </section>

        <section
          id="ficha-MOVES"
          ref={(el) => (sectionRefs.current.MOVES = el)}
          data-section-key="MOVES"
          className={sectionClassName(styles, 'MOVES', section)}
        >
          <SectionHeading label={sectionLabel.MOVES[language]} sectionKey="MOVES" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.MOVES} preview={sectionPreviews.MOVES} />
          <div className={collapseWrapClassName(styles, 'MOVES', openSection)}>
          <div className={`${styles.collapseInner} ${movesSettled ? styles.collapseInnerSticky : ''}`}>
          {activeVersionGroup && scopedMoves.length === 0 ? (
            <p>{t('ficha.noMovesInGame')}</p>
          ) : (
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
              {scopedMoves
                .map((m) => {
                  const { method, level } = moveLearnMethod(pokemon.moves, m.name, activeVersionGroup)
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
          )}
          </div>
          </div>
        </section>

        <section
          id="ficha-INFO"
          ref={(el) => (sectionRefs.current.INFO = el)}
          data-section-key="INFO"
          className={sectionClassName(styles, 'INFO', section)}
        >
          <SectionHeading label={sectionLabel.INFO[language]} sectionKey="INFO" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.INFO} preview={sectionPreviews.INFO} />
          <div className={collapseWrapClassName(styles, 'INFO', openSection)}>
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
          <SectionHeading label={sectionLabel.FORM[language]} sectionKey="FORM" openSection={openSection} onToggle={toggleCollapse} color={primaryColor} icon={SECTION_ICONS.FORM} preview={sectionPreviews.FORM} />
          <div className={collapseWrapClassName(styles, 'FORM', openSection)}>
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
                    <Link to={`/ficha/${f.name ?? f.id}`} className={styles.formCardInner}>
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
