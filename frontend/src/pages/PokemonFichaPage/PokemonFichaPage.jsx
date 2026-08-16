import { Link, useParams } from 'react-router-dom'
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
import { localizedEntry, localizedName } from '../../utils/pokeApiLocalization.js'
import {
  FICHA_SECTIONS,
  damageClassName,
  evolutionStages,
  flavorTextsByVersion,
  genusForLanguage,
  generationNumber,
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
  const pokemonNames = usePokemonNames()
  const pokemon = ficha?.pokemon
  const heroImage = useImageFallback(
    pokemon ? spriteHomeUrl(pokemon.id) : null,
    pokemon ? (pokemon.sprites.other?.['official-artwork']?.front_default ?? officialArtworkUrl(pokemon.id)) : null,
  )

  if (status === 'loading') return <p className={styles.status}>Cargando…</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!ficha) return null

  const { species, evolutionChain, moves, abilities, forms, missing } = ficha
  const types = pokemon.types.map((t) => t.type.name)
  const primaryColor = typeColor(types[0])
  const secondaryColor = typeColor(types[1] ?? types[0])
  const missingTotal = totalMissing(missing)
  const generation = generationNumber(species)

  const versions = flavorTextsByVersion(species, language)
  const activeVersion = versions.find((v) => v.version === selectedVersion) ?? versions[0]
  const displayName = speciesDisplayName(species, language, capitalize(pokemon.name))

  return (
    <section className={styles.page}>
      {missingTotal > 0 && (
        <div className={styles.cacheBar}>
          <span>Faltan {missingTotal} recursos por cachear para completar esta ficha.</span>
          <button type="button" onClick={cacheMissing} disabled={caching}>
            {caching ? 'Cacheando…' : 'Cachear todo lo que falta'}
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
              Altura <strong>{(pokemon.height / 10).toFixed(1)} m</strong>
            </span>
            <span className={styles.metricChip}>
              Peso <strong>{(pokemon.weight / 10).toFixed(1)} kg</strong>
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
              {label}
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
                    <span className={styles.notTranslated}>
                      Sin traducción de PokeAPI para este idioma en este juego — se muestra en inglés.
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p>Descripción no disponible — cachea pokemon-species.</p>
            )}
          </div>
        )}

        {section === 'EVOS' && (
          evolutionChain ? (
            <div className={styles.evoList}>
              {evolutionStages(evolutionChain).map((stage, i) => (
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
            <p>Cadena evolutiva no cacheada todavía.</p>
          )
        )}

        {section === 'STATS' && (
          <div className={styles.statsPanel}>
            <StatRadarChart stats={pokemon.stats} color={primaryColor} />
            <p className={styles.statsTotal}>
              Total <strong>{pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0)}</strong>
            </p>
          </div>
        )}

        {section === 'ABILITY' && (
          <ul className={styles.cardList}>
            {abilities.map((a) => {
              const hidden = pokemon.abilities.find((slot) => slot.ability.name === a.name)?.is_hidden
              const effect = localizedEntry(a.payload?.effect_entries, language, 'short_effect')
              const abilityName = localizedName(a.payload, language, capitalize(a.name.replace(/-/g, ' ')))

              return (
                <li key={a.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <strong>{abilityName}</strong>
                    {hidden && <span className={styles.tag}>Oculta</span>}
                  </div>
                  {a.cached ? (
                    <p>{effect ?? 'Sin descripción disponible.'}</p>
                  ) : (
                    <p className={styles.notCached}>No cacheada todavía.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {section === 'MOVES' && (
          <ul className={styles.cardList}>
            {moves.map((m) => (
              <li key={m.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <strong>{localizedName(m.payload, language, capitalize(m.name.replace(/-/g, ' ')))}</strong>
                  {m.payload && <TypeBadge type={m.payload.type.name} />}
                </div>
                {m.cached ? (
                  <div className={styles.moveStats}>
                    <span>
                      Pot. <strong>{m.payload.power ?? '-'}</strong>
                    </span>
                    <span>
                      PP <strong>{m.payload.pp ?? '-'}</strong>
                    </span>
                    <span>
                      Prec. <strong>{m.payload.accuracy != null ? `${m.payload.accuracy}%` : '-'}</strong>
                    </span>
                    <span className={styles.tag}>{damageClassName(m.payload.damage_class.name, language)}</span>
                  </div>
                ) : (
                  <p className={styles.notCached}>No cacheado todavía.</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {section === 'INFO' && (
          species ? (
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt>Exp. Base</dt>
                <dd>{pokemon.base_experience ?? '-'}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Género</dt>
                <dd>
                  {species.gender_rate === -1 ? (
                    'Sin género'
                  ) : (
                    <div className={styles.genderBar}>
                      <div className={styles.genderMale} style={{ width: `${((8 - species.gender_rate) / 8) * 100}%` }} />
                      <div className={styles.genderFemale} style={{ width: `${(species.gender_rate / 8) * 100}%` }} />
                    </div>
                  )}
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Captura</dt>
                <dd>
                  <div className={styles.captureBar}>
                    <div className={styles.captureFill} style={{ width: `${(species.capture_rate / 255) * 100}%` }} />
                  </div>
                  <span>{species.capture_rate} / 255</span>
                </dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Felicidad Base</dt>
                <dd>{species.base_happiness}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Grupo Huevo</dt>
                <dd>{species.egg_groups.map((g) => capitalize(g.name)).join(', ')}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Pasos Eclosión</dt>
                <dd>~{(species.hatch_counter + 1) * 255}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt>Crecimiento</dt>
                <dd>{capitalize(species.growth_rate.name.replace(/-/g, ' '))}</dd>
              </div>
              {species.habitat && (
                <div className={styles.infoRow}>
                  <dt>Hábitat</dt>
                  <dd>{capitalize(species.habitat.name)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p>Cachea pokemon-species para ver esta sección.</p>
          )
        )}

        {section === 'FORM' && (
          <ul className={styles.cardList}>
            {forms.map((f) => (
              <li key={f.id} className={styles.card}>
                {localizedName(f.payload, language, capitalize(f.name.replace(/-/g, ' ')))}
                {!f.cached && <span className={styles.notCached}> — no cacheada</span>}
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
