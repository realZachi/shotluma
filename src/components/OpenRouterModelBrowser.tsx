import { useEffect, useId, useMemo, useState } from 'react'
import { Search01 } from './icons'
import { Input } from './ui/input'
import type { AiModelOption } from '../ai/provider-catalog'

const VISIBLE_MODEL_LIMIT = 60

export type CatalogModelsResult = {
  models: readonly AiModelOption[]
  source: 'remote' | 'cache' | 'fallback'
}

export type AiCatalogModelBrowserProps = {
  heading: string
  selectedModelId: string
  onModelSelect: (modelId: string) => void
  loadModels: () => Promise<CatalogModelsResult>
  fallbackNote?: string
}

const filterModels = (
  models: readonly AiModelOption[],
  query: string,
): readonly AiModelOption[] => {
  const needle = query.trim().toLowerCase()
  if (!needle) return models
  return models.filter((model) =>
    model.label.toLowerCase().includes(needle)
    || model.id.toLowerCase().includes(needle))
}

/**
 * Searchable list over a runtime provider catalog. Shown in the model picker
 * once the user chooses "Other models…".
 */
export const AiCatalogModelBrowser = ({
  heading,
  selectedModelId,
  onModelSelect,
  loadModels,
  fallbackNote = 'Model list could not be loaded — showing the built-in shortlist.',
}: AiCatalogModelBrowserProps) => {
  const labelId = useId()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<CatalogModelsResult | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadModels().then((loaded) => {
      if (!cancelled) setResult(loaded)
    })
    return () => {
      cancelled = true
    }
    // Load once when this catalog panel mounts; the parent remounts it per provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const models = useMemo(
    () => result?.models ?? [],
    [result],
  )
  const filtered = useMemo(() => filterModels(models, query), [models, query])
  const visible = filtered.slice(0, VISIBLE_MODEL_LIMIT)

  return (
    <div className="ai-model-picker-section">
      <span className="ai-model-picker-section__label" id={labelId}>
        {result ? `${heading} (${models.length})` : heading}
      </span>
      <div className="ai-openrouter-search">
        <Search01 size={13} aria-hidden="true" />
        <Input
          type="search"
          value={query}
          placeholder="Search models…"
          aria-labelledby={labelId}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {result?.source === 'fallback' && (
        <small className="ai-openrouter-note" role="status">
          {fallbackNote}
        </small>
      )}
      <div className="ai-openrouter-list" role="listbox" aria-labelledby={labelId}>
        {!result && <small className="ai-openrouter-note">Loading models…</small>}
        {result && visible.length === 0 && (
          <small className="ai-openrouter-note">{`No models match “${query.trim()}”.`}</small>
        )}
        {visible.map((model) => (
          <button
            key={model.id}
            type="button"
            role="option"
            aria-selected={model.id === selectedModelId}
            className={model.id === selectedModelId ? 'is-active' : undefined}
            onClick={() => onModelSelect(model.id)}
          >
            <span className="ai-openrouter-list__label">{model.label}</span>
            <span className="ai-openrouter-list__meta">{model.description}</span>
          </button>
        ))}
        {filtered.length > visible.length && (
          <small className="ai-openrouter-note">
            {`${filtered.length - visible.length} more — refine the search to narrow down.`}
          </small>
        )}
      </div>
    </div>
  )
}
