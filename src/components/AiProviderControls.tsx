import { useEffect, useState } from 'react'
import {
  isOpencodeProviderId,
  listOpencodeVisionModels,
  loadAllOpencodeModels,
  loadOpencodeModels,
  pickOpencodeVisionModel,
  type OpencodeProviderId,
} from '../ai/opencode-models'
import { loadOpenRouterModels } from '../ai/openrouter-models'
import {
  AI_PROVIDERS,
  AI_REASONING_EFFORT_LABELS,
  clampAiReasoningEffort,
  findAiModelById,
  getAiModel,
  getAiProvider,
  getDynamicProviderModels,
  modelSupportsVision,
  type AiModelOption,
  type AiModelSelection,
  type AiProviderId,
  type AiProviderOption,
  type AiReasoningEffort,
} from '../ai/provider-catalog'
import {
  AiGenerative,
  AiNetwork,
  AlertCircle,
  ChatGpt,
  ChevronDown,
  Claude,
  GoogleGemini,
  Grok,
  KimiAi,
  Qwen,
} from './icons'
import { AiCatalogModelBrowser } from './OpenRouterModelBrowser'
import { Button } from './ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import type { AiProviderAvailability } from '../ai/provider-config'
import type { ComponentType } from 'react'

/**
 * Sentinel entry in the OpenRouter select group: opens the searchable catalog
 * browser instead of selecting a model. Real OpenRouter ids use `vendor/model`,
 * so the `:` namespace cannot collide.
 */
const CATALOG_BROWSE_SUFFIX = ':browse-all'

const catalogBrowseValue = (providerId: AiProviderId): string =>
  `${providerId}${CATALOG_BROWSE_SUFFIX}`

const catalogProviderFromBrowseValue = (value: string): AiProviderId | null => {
  if (!value.endsWith(CATALOG_BROWSE_SUFFIX)) return null
  const providerId = value.slice(0, -CATALOG_BROWSE_SUFFIX.length)
  return AI_PROVIDERS.some((provider) => provider.id === providerId)
    ? providerId as AiProviderId
    : null
}

const CATALOG_BROWSE_PROVIDERS = new Set<AiProviderId>([
  'openrouter',
  'opencode-zen',
  'opencode-go',
])

const AI_PROVIDER_ICONS: Record<AiProviderId, ComponentType<{ className?: string; size?: number }>> = {
  codex: ChatGpt,
  moonshot: KimiAi,
  google: GoogleGemini,
  qwen: Qwen,
  openai: ChatGpt,
  anthropic: Claude,
  xai: Grok,
  openrouter: AiNetwork,
  'opencode-zen': AiGenerative,
  'opencode-go': AiGenerative,
}

export type AiProviderControlsProps = {
  selection: AiModelSelection
  availability: AiProviderAvailability
  transportAvailability: AiProviderAvailability
  onModelSelect: (providerId: AiProviderId, modelId: string) => void
  onReasoningEffortChange: (reasoningEffort: AiReasoningEffort) => void
  onVisionModelChange: (visionModel: string) => void
  onManageKeys: (providerId: AiProviderId) => void
  onConnectCodex: () => void
}

const triggerLabel = (
  modelLabel: string,
  reasoningEffort: AiReasoningEffort | undefined,
): string => {
  if (!reasoningEffort) return modelLabel
  return `${modelLabel} · ${AI_REASONING_EFFORT_LABELS[reasoningEffort]}`
}

const uniqueVisionModels = (providerId: OpencodeProviderId): AiModelOption[] => {
  const models = [
    ...getAiProvider(providerId).models,
    ...getDynamicProviderModels(providerId),
  ]
  const seen = new Set<string>()
  return listOpencodeVisionModels(models).filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

const providerGroupCaption = (
  option: AiProviderOption,
  availability: AiProviderAvailability,
  transportAvailability: AiProviderAvailability,
): string => {
  if (availability[option.id]) return option.label
  if (option.id === 'codex') return `${option.label} · connect`
  if (transportAvailability[option.id]) return `${option.label} · key missing`
  return `${option.label} · local proxy unavailable`
}

const CatalogModelBrowsers = ({
  browsingProvider,
  selectedModelId,
  onModelSelect,
}: {
  browsingProvider: AiProviderId | null
  selectedModelId: string
  onModelSelect: (providerId: AiProviderId, modelId: string) => void
}) => {
  if (browsingProvider === 'openrouter') {
    return (
      <AiCatalogModelBrowser
        heading="All OpenRouter models"
        selectedModelId={selectedModelId}
        loadModels={loadOpenRouterModels}
        onModelSelect={(modelId) => onModelSelect('openrouter', modelId)}
      />
    )
  }
  if (!isOpencodeProviderId(browsingProvider)) return null
  return (
    <AiCatalogModelBrowser
      heading={`All ${getAiProvider(browsingProvider).label} models`}
      selectedModelId={selectedModelId}
      loadModels={() => loadOpencodeModels(browsingProvider)}
      onModelSelect={(modelId) => onModelSelect(browsingProvider, modelId)}
    />
  )
}

const VisionFallbackPicker = ({
  codingModelLabel,
  visionModel,
  visionModels,
  onVisionModelChange,
}: {
  codingModelLabel: string
  visionModel: AiModelOption
  visionModels: readonly AiModelOption[]
  onVisionModelChange: (visionModel: string) => void
}) => (
  <div className="ai-model-picker-section">
    <span className="ai-model-picker-section__label" id="ai-vision-label">
      Vision fallback
    </span>
    <Select
      value={visionModel.id}
      onValueChange={(value) => {
        if (typeof value === 'string') onVisionModelChange(value)
      }}
    >
      <SelectTrigger
        id="ai-vision-trigger"
        className="ai-provider-trigger"
        aria-labelledby="ai-vision-label"
        aria-label="Vision fallback model"
      >
        <SelectValue>
          <span>{visionModel.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="ai-modal-select-content">
        {visionModels.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <small className="ai-provider-description">
      {codingModelLabel} cannot see images. {visionModel.label} will describe
      screenshots and previews first.
    </small>
  </div>
)

const ProviderSetupWarning = ({
  providerId,
  keyLabel,
  isTransportAvailable,
  onManageKeys,
  onConnectCodex,
}: {
  providerId: AiProviderId
  keyLabel: string
  isTransportAvailable: boolean
  onManageKeys: (providerId: AiProviderId) => void
  onConnectCodex: () => void
}) => {
  const isCodex = providerId === 'codex'
  return (
    <div className="ai-provider-warning" role="alert">
      <AlertCircle size={15} />
      <div className="ai-provider-warning-body">
        <span>
          {isCodex
            ? <><b>Codex isn’t connected.</b> Use your ChatGPT plan without an API key.</>
            : isTransportAvailable
              ? <><b>API key missing.</b> Add your {keyLabel} key to generate with this model.</>
              : <><b>Local proxy unavailable.</b> Moonshot can be used only from localhost.</>}
        </span>
        {(isCodex || isTransportAvailable) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ai-provider-warning-action"
            onClick={() => {
              if (isCodex) onConnectCodex()
              else onManageKeys(providerId)
            }}
          >
            {isCodex ? 'Connect Codex' : 'Enter API key'}
          </Button>
        )}
      </div>
    </div>
  )
}

export const AiProviderControls = ({
  selection,
  availability,
  transportAvailability,
  onModelSelect,
  onReasoningEffortChange,
  onVisionModelChange,
  onManageKeys,
  onConnectCodex,
}: AiProviderControlsProps) => {
  const [browsingProvider, setBrowsingProvider] = useState<AiProviderId | null>(null)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const provider = getAiProvider(selection.provider)
  const model = getAiModel(selection)
  const isConfigured = availability[selection.provider]
  const isTransportAvailable = transportAvailability[selection.provider]
  const reasoningEffort = clampAiReasoningEffort(model, selection.reasoningEffort)
  const SelectedIcon = AI_PROVIDER_ICONS[selection.provider]
  const keyLabel = provider.keyGroup?.label ?? provider.label
  const needsVisionFallback = isOpencodeProviderId(selection.provider)
    && !modelSupportsVision(model)
  void catalogRevision
  const visionModels = isOpencodeProviderId(selection.provider)
    ? uniqueVisionModels(selection.provider)
    : []
  const visionModel = needsVisionFallback && isOpencodeProviderId(selection.provider)
    ? pickOpencodeVisionModel(selection.provider, visionModels, selection.visionModel)
    : undefined

  useEffect(() => {
    void loadAllOpencodeModels().then(() => {
      setCatalogRevision((current) => current + 1)
    })
  }, [])

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <Button
            type="button"
            variant="outline"
            className="ai-model-picker-trigger"
            aria-label="AI model and reasoning effort"
          />
        )}
      >
        <span
          className={`ai-model-picker-status${isConfigured ? ' is-ready' : ' is-missing'}`}
          aria-hidden="true"
        />
        <SelectedIcon className="ai-provider-icon" size={15} />
        <span className="ai-model-picker-trigger__label">
          {triggerLabel(model.label, reasoningEffort)}
        </span>
        <ChevronDown size={14} className="ai-model-picker-trigger__chevron" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="ai-model-picker-popover"
      >
        <div className="ai-model-picker-section">
          <span className="ai-model-picker-section__label" id="ai-model-label">
            Model
          </span>
          <Select
            value={selection.model}
            onValueChange={(value) => {
              if (typeof value !== 'string') return
              const browseProvider = catalogProviderFromBrowseValue(value)
              if (browseProvider) {
                setBrowsingProvider(browseProvider)
                return
              }
              setBrowsingProvider(null)
              const match = findAiModelById(value)
              onModelSelect(match.provider.id, match.model.id)
            }}
          >
            <SelectTrigger
              id="ai-model-trigger"
              className="ai-provider-trigger"
              aria-labelledby="ai-model-label"
              aria-label="AI model"
            >
              <SelectValue>
                <span>{`${provider.label} · ${model.label}`}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="ai-modal-select-content">
              {AI_PROVIDERS.map((option) => {
                const ProviderIcon = AI_PROVIDER_ICONS[option.id]
                return (
                  <SelectGroup key={option.id}>
                    <SelectLabel>
                      <ProviderIcon className="ai-provider-icon" size={14} />
                      <span>
                        {providerGroupCaption(option, availability, transportAvailability)}
                      </span>
                    </SelectLabel>
                    {option.models.map((modelOption) => (
                      <SelectItem key={modelOption.id} value={modelOption.id}>
                        {modelOption.label}
                      </SelectItem>
                    ))}
                    {CATALOG_BROWSE_PROVIDERS.has(option.id) && (
                      <SelectItem value={catalogBrowseValue(option.id)}>
                        Other models…
                      </SelectItem>
                    )}
                  </SelectGroup>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <CatalogModelBrowsers
          browsingProvider={browsingProvider}
          selectedModelId={selection.model}
          onModelSelect={onModelSelect}
        />

        {needsVisionFallback && visionModel && (
          <VisionFallbackPicker
            codingModelLabel={model.label}
            visionModel={visionModel}
            visionModels={visionModels}
            onVisionModelChange={onVisionModelChange}
          />
        )}

        {model.reasoningEfforts && reasoningEffort && (
          <div className="ai-model-picker-section">
            <span className="ai-model-picker-section__label" id="ai-effort-label">
              Reasoning effort
            </span>
            <div
              className="ai-effort-segmented"
              role="radiogroup"
              aria-labelledby="ai-effort-label"
            >
              {model.reasoningEfforts.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={reasoningEffort === option}
                  className={reasoningEffort === option ? 'is-active' : undefined}
                  onClick={() => onReasoningEffortChange(option)}
                >
                  {AI_REASONING_EFFORT_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ai-provider-meta">
          <small className="ai-provider-description">{model.description}</small>
          <button
            type="button"
            className="ai-provider-keys-link"
            onClick={() => {
              if (selection.provider === 'codex') onConnectCodex()
              else onManageKeys(selection.provider)
            }}
          >
            {selection.provider === 'codex' ? 'Codex connection' : 'API keys'}
          </button>
        </div>

        {!isConfigured && (
          <ProviderSetupWarning
            providerId={selection.provider}
            keyLabel={keyLabel}
            isTransportAvailable={isTransportAvailable}
            onManageKeys={onManageKeys}
            onConnectCodex={onConnectCodex}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
