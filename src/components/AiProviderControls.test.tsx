import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AiProviderControls } from './AiProviderControls'
import type { ComponentProps, ReactNode } from 'react'

vi.mock('./ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SelectItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SelectTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('./ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({
    children,
    render,
    ...props
  }: {
    children?: ReactNode
    render?: ReactNode
  } & ComponentProps<'button'>) => (
    <button {...props}>
      {render}
      {children}
    </button>
  ),
  PopoverContent: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
}))

const availableTransports = {
  codex: true,
  moonshot: true,
  google: true,
  qwen: true,
  openai: true,
  anthropic: true,
  xai: true,
  openrouter: true,
}

vi.mock('./ui/button', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('./ui/input', () => ({
  Input: (props: ComponentProps<'input'>) => <input {...props} />,
}))

describe('AI provider controls', () => {
  it('shows a compact trigger with model, effort, and status', () => {
    const markup = renderToStaticMarkup(
      <AiProviderControls
        selection={{
          provider: 'google',
          model: 'gemini-3.6-flash',
          reasoningEffort: 'high',
        }}
        availability={{
          codex: false,
          moonshot: false,
          google: true,
          qwen: false,
          openai: false,
          anthropic: false,
          xai: false,
          openrouter: false,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(markup).toContain('Gemini 3.6 Flash · High')
    expect(markup).toContain('ai-model-picker-status is-ready')
    expect(markup).toContain('Google · Gemini 3.6 Flash')
    expect(markup).toContain('API keys')
  })

  it('shows a missing-key warning with a button to open the keys dialog', () => {
    const markup = renderToStaticMarkup(
      <AiProviderControls
        selection={{ provider: 'openai', model: 'gpt-5.6-terra' }}
        availability={{
          codex: false,
          moonshot: true,
          google: true,
          qwen: true,
          openai: false,
          anthropic: true,
          xai: true,
          openrouter: true,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(markup).toContain('API key missing.')
    expect(markup).toContain('Add your OpenAI key')
    expect(markup).toContain('Enter API key')
    expect(markup).toContain('OpenAI · key missing')
    expect(markup).toContain('API keys')
    expect(markup).toContain('ai-model-picker-status is-missing')
    expect(markup).not.toContain('.env.local')
  })

  it('offers the ChatGPT connection instead of an API key for Codex', () => {
    const markup = renderToStaticMarkup(
      <AiProviderControls
        selection={{
          provider: 'codex',
          model: 'codex/gpt-5.6-terra',
          reasoningEffort: 'high',
        }}
        availability={{
          codex: false,
          moonshot: false,
          google: false,
          qwen: false,
          openai: false,
          anthropic: false,
          xai: false,
          openrouter: false,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(markup).toContain('Codex isn’t connected.')
    expect(markup).toContain('Use your ChatGPT plan without an API key.')
    expect(markup).toContain('Connect Codex')
    expect(markup).toContain('Codex connection')
    expect(markup).not.toContain('Enter API key')
  })

  it('shows model-specific reasoning effort chips and omits them for models without effort', () => {
    const openAiMarkup = renderToStaticMarkup(
      <AiProviderControls
        selection={{
          provider: 'openai',
          model: 'gpt-5.6-sol',
          reasoningEffort: 'high',
        }}
        availability={{
          codex: false,
          moonshot: false,
          google: false,
          qwen: false,
          openai: true,
          anthropic: false,
          xai: false,
          openrouter: false,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(openAiMarkup).toContain('Reasoning effort')
    expect(openAiMarkup).not.toContain('Provider default')
    expect(openAiMarkup).toContain('Low')
    expect(openAiMarkup).toContain('Medium')
    expect(openAiMarkup).toContain('High')
    expect(openAiMarkup).toContain('XHigh')
    expect(openAiMarkup).toContain('Max')
    expect(openAiMarkup).toContain('role="radiogroup"')

    const moonshotMarkup = renderToStaticMarkup(
      <AiProviderControls
        selection={{
          provider: 'moonshot',
          model: 'kimi-k3',
          reasoningEffort: 'high',
        }}
        availability={{
          codex: false,
          moonshot: true,
          google: false,
          qwen: false,
          openai: false,
          anthropic: false,
          xai: false,
          openrouter: false,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(moonshotMarkup).toContain('Reasoning effort')
    expect(moonshotMarkup).toContain('Low')
    expect(moonshotMarkup).toContain('High')
    expect(moonshotMarkup).toContain('Max')
    expect(moonshotMarkup).not.toContain('Medium')
    expect(moonshotMarkup).not.toContain('Provider default')
    expect(moonshotMarkup).toContain('Kimi K3 · High')
    expect(moonshotMarkup).toContain('Moonshot · Kimi K3')
  })

  it('shows an "Other models" entry in the OpenRouter group', () => {
    const markup = renderToStaticMarkup(
      <AiProviderControls
        selection={{
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-5',
          reasoningEffort: 'high',
        }}
        availability={{
          codex: false,
          moonshot: false,
          google: false,
          qwen: false,
          openai: false,
          anthropic: false,
          xai: false,
          openrouter: true,
        }}
        transportAvailability={availableTransports}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(markup).toContain('OpenRouter · Claude Sonnet 5')
    expect(markup).toContain('Other models…')
    expect(markup).not.toContain('All OpenRouter models')
  })

  it('explains when the Moonshot proxy is unavailable instead of asking for a key', () => {
    const markup = renderToStaticMarkup(
      <AiProviderControls
        selection={{ provider: 'moonshot', model: 'kimi-k3' }}
        availability={{
          codex: false,
          moonshot: false,
          google: false,
          qwen: false,
          openai: false,
          anthropic: false,
          xai: false,
          openrouter: false,
        }}
        transportAvailability={{ ...availableTransports, moonshot: false }}
        onModelSelect={() => undefined}
        onReasoningEffortChange={() => undefined}
        onManageKeys={() => undefined}
        onConnectCodex={() => undefined}
      />,
    )

    expect(markup).toContain('Local proxy unavailable.')
    expect(markup).toContain('Moonshot · local proxy unavailable')
    expect(markup).not.toContain('Enter API key')
  })
})
