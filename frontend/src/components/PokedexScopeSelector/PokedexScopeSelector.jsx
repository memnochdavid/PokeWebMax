import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { REGION_ORDER, regionLabel } from '../../utils/pokedexRegions.js'
import styles from './PokedexScopeSelector.module.css'

// Nacional/Regional → (si Regional) Región o Juego → edición/juego concreto. Dos modos
// deliberadamente distintos dentro de "Regional", no uno solo — un mismo juego puede
// repartirse en varias Pokédex a la vez (ej. Espada/Escudo en galar + isle-of-armor +
// crown-tundra), así que "por juego" no siempre resuelve a la misma Pokédex que
// "por región" (ver .claude/memory/project_pokewebmax_progress.md).
export default function PokedexScopeSelector({
  pokedexScope,
  onSetScope,
  pokedexMode,
  onSetMode,
  pokedexRegion,
  onSetRegion,
  pokedexName,
  onSetPokedexName,
  pokedexOptionsForRegion,
  versionName,
  onSetVersionName,
  hasSiblingVersions,
  exclusiveOnly,
  onSetExclusiveOnly,
  catalog,
  language,
}) {
  const { t } = useTranslation()

  const availableRegions = useMemo(() => {
    const present = new Set(catalog.pokedexes.map((p) => p.region))
    return REGION_ORDER.filter((slug) => present.has(slug))
  }, [catalog.pokedexes])

  return (
    <div className={styles.row}>
      <select
        className={styles.select}
        value={pokedexScope}
        onChange={(e) => onSetScope(e.target.value)}
      >
        <option value="national">{t('list.scopeNational')}</option>
        <option value="regional">{t('list.scopeRegional')}</option>
      </select>

      {pokedexScope === 'regional' && (
        <>
          <select className={styles.select} value={pokedexMode} onChange={(e) => onSetMode(e.target.value)}>
            <option value="region">{t('list.modeRegion')}</option>
            <option value="game">{t('list.modeGame')}</option>
          </select>

          {pokedexMode === 'region' && (
            <>
              <select
                className={styles.select}
                value={pokedexRegion}
                onChange={(e) => onSetRegion(e.target.value)}
              >
                <option value="">{t('list.regionPlaceholder')}</option>
                {availableRegions.map((slug) => (
                  <option key={slug} value={slug}>
                    {regionLabel(slug, language)}
                  </option>
                ))}
              </select>

              {pokedexRegion && pokedexOptionsForRegion.length > 1 && (
                <select
                  className={styles.select}
                  value={pokedexName}
                  onChange={(e) => onSetPokedexName(e.target.value)}
                >
                  <option value="">{t('list.editionPlaceholder')}</option>
                  {pokedexOptionsForRegion.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.label[language] ?? entry.label.es ?? entry.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {pokedexMode === 'game' && (
            <>
              <select
                className={styles.select}
                value={versionName}
                onChange={(e) => onSetVersionName(e.target.value)}
              >
                <option value="">{t('list.gamePlaceholder')}</option>
                {catalog.versions.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.label[language] ?? entry.label.es ?? entry.name}
                  </option>
                ))}
              </select>

              {versionName && hasSiblingVersions && (
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={exclusiveOnly}
                    onChange={(e) => onSetExclusiveOnly(e.target.checked)}
                  />
                  {t('list.exclusiveOnly')}
                </label>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
