import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { REGION_ORDER, regionLabel } from '../../utils/pokedexRegions.js'
import styles from './PokedexScopeSelector.module.css'

// Nacional / Regional / Juego, un único select de primer nivel — Regional lleva
// directamente al select de región y Juego al select de juego, sin un select
// intermedio de "modo" (pedido explícito de David: nunca deben coexistir 3 selects a
// la vez). Regional y Juego son ámbitos deliberadamente distintos, no un mismo modo —
// un mismo juego puede repartirse en varias Pokédex a la vez (ej. Espada/Escudo en
// galar + isle-of-armor + crown-tundra), así que "por juego" no siempre resuelve a la
// misma Pokédex que "por región" (ver .claude/memory/project_pokewebmax_progress.md).
export default function PokedexScopeSelector({
  pokedexScope,
  onSetScope,
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
      {/* Los dos primeros selects (ámbito + región/juego) comparten línea a
          propósito — pedido explícito de David 2026-08-24, tras verlo en la columna
          angosta de filtros (ver PokemonListPage.module.css): "en lugar de meterle un
          overflow, podemos aprovechar el espacio horizontal". El 3er select
          (edición, solo con región de varias Pokédex) y el checkbox de "solo
          exclusivos" se quedan en su propia línea debajo — nunca coexisten los 3
          selects completos en la misma fila, hay sitio de sobra para uno solo. */}
      <div className={styles.rowPrimary}>
        <select
          className={styles.select}
          value={pokedexScope}
          onChange={(e) => onSetScope(e.target.value)}
        >
          <option value="national">{t('list.scopeNational')}</option>
          <option value="regional">{t('list.scopeRegional')}</option>
          <option value="game">{t('list.scopeGame')}</option>
        </select>

        {pokedexScope === 'regional' && (
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
        )}

        {pokedexScope === 'game' && (
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
        )}
      </div>

      {pokedexScope === 'regional' && pokedexRegion && pokedexOptionsForRegion.length > 1 && (
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

      {pokedexScope === 'game' && versionName && hasSiblingVersions && (
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={exclusiveOnly}
            onChange={(e) => onSetExclusiveOnly(e.target.checked)}
          />
          {t('list.exclusiveOnly')}
        </label>
      )}
    </div>
  )
}
