import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  appendNarrationDelta,
  createNarrationState,
  type NarrationSource,
  type NarrationState,
} from '../ai/run-narration'
import { AiRunBand, type AiRunBandProps } from './AiRunBand'
import type { ComponentProps } from 'react'

// The generated shadcn button imports through the `@/` alias, which the test runner
// does not resolve. The band only relies on its label and click handler.
vi.mock('./ui/button', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

const narrationOf = (deltas: [NarrationSource, string][]): NarrationState =>
  deltas.reduce(
    (state, [source, delta]) => appendNarrationDelta(state, source, delta),
    createNarrationState(),
  )

const plan = [
  { name: 'Hero', role: 'strongest benefit' },
  { name: 'Feature', role: 'differentiator' },
  { name: 'Ritual', role: 'daily use' },
]

const markup = (overrides: Partial<AiRunBandProps> = {}) => renderToStaticMarkup(
  <AiRunBand
    phase="running"
    narration={narrationOf([['text', 'Building the hero now.']])}
    plan={plan}
    slidesBuilt={1}
    latestActivity=""
    summary=""
    errorMessage={null}
    onCancel={vi.fn()}
    onClose={vi.fn()}
    onRetry={vi.fn()}
    {...overrides}
  />,
)

describe('AiRunBand', () => {
  it('names the current screen, its role, and the planned total', () => {
    const html = markup()
    expect(html).toContain('SCREEN 2 OF 3')
    expect(html).toContain('DIFFERENTIATOR')
  })

  it('shows planned screens that do not exist yet', () => {
    const html = markup()
    expect(html).toContain('Hero')
    expect(html).toContain('Ritual')
    expect(html).toContain('ai-run-band__screen--planned')
    expect(html).toContain('ai-run-band__screen--building')
    expect(html).toContain('ai-run-band__screen--built')
  })

  it('names the latest action without a count', () => {
    const html = markup({ latestActivity: 'Preview checked' })
    expect(html).toContain('Preview checked')
    expect(html).toContain('ai-run-band__activity')
    expect(html).not.toContain('shimmer')
    expect(html).not.toContain('actions')
    expect(html).not.toContain('update_element')
  })

  it('keeps raw tool names out of the activity line', () => {
    expect(markup({ latestActivity: 'Element updated' })).not.toContain('update_element')
  })

  it('hides the activity line once the run is over', () => {
    const html = markup({ phase: 'done', latestActivity: 'Preview checked', summary: 'Done.' })
    expect(html).not.toContain('Preview checked')
    expect(html).not.toContain('actions')
  })

  it('shows the current action instead of a dead waiting line before prose arrives', () => {
    const html = markup({ narration: createNarrationState(), latestActivity: 'Background updated' })
    expect(html).toContain('Background updated')
    expect(html).not.toContain('Starting up …')
  })

  it('still greets with a waiting line when nothing has happened at all', () => {
    expect(markup({ narration: createNarrationState() })).toContain('Starting up …')
  })

  it('distinguishes reasoning from assistant prose', () => {
    const html = markup({
      narration: narrationOf([['text', 'Plan is set. '], ['reasoning', 'Headline collides.']]),
    })
    expect(html).toContain('ai-run-band__line--text')
    expect(html).toContain('ai-run-band__line--reasoning')
  })

  it('fades every sentence except the newest', () => {
    const html = markup({ narration: narrationOf([['text', 'One. Two.']]) })
    expect(html.match(/ai-run-band__line--past/g)).toHaveLength(1)
  })

  it('hides the rail in edit mode and names the target screen', () => {
    const html = markup({ targetName: 'Ritual screen', plan: [] })
    expect(html).toContain('EDITING · Ritual screen')
    expect(html).not.toContain('SCREENS')
    expect(html).toContain('ai-run-band--narrow')
  })

  it('offers cancel while running and nothing else', () => {
    const html = markup()
    expect(html).toContain('Cancel')
    expect(html).toContain('ai-run-band__cancel')
    expect(html).not.toContain('Try again')
  })

  it('becomes the result when the run finishes', () => {
    const html = markup({ phase: 'done', slidesBuilt: 3, summary: 'A warm, gentle set.' })
    expect(html).toContain('DONE · 3 SCREENS')
    expect(html).toContain('A warm, gentle set.')
    expect(html).toContain('Done')
    expect(html).not.toContain('Cancel')
  })

  it('renders a provider-formatted completion as plain band copy', () => {
    const html = markup({
      phase: 'done',
      slidesBuilt: 1,
      summary: '### **Screenshot set complete**',
    })
    expect(html).toContain('Screenshot set complete')
    expect(html).not.toContain('**')
    expect(html).not.toContain('###')
  })

  it('drops unbuilt screens from a finished run', () => {
    const html = markup({ phase: 'done', slidesBuilt: 2, summary: 'Two screens.' })
    expect(html).toContain('Hero')
    expect(html).not.toContain('Ritual')
  })

  it('reports the edited screen on a finished edit', () => {
    expect(markup({ phase: 'done', targetName: 'Hero', summary: 'Tightened.' }))
      .toContain('UPDATED · Hero')
  })

  it('shows the error in place and offers a retry', () => {
    const html = markup({ phase: 'error', errorMessage: 'Rate limit reached.' })
    expect(html).toContain('Rate limit reached.')
    expect(html).toContain('RUN STOPPED')
    expect(html).toContain('Try again')
    expect(html).toContain('ai-run-band__live--error')
  })

  it('falls back to a readable message when an error carries no text', () => {
    expect(markup({ phase: 'error', errorMessage: null })).toContain('stopped unexpectedly')
  })

  it('stays useful before the first sentence arrives', () => {
    const html = markup({ narration: createNarrationState(), plan: [], slidesBuilt: 0 })
    expect(html).toContain('Starting up …')
  })

  it('falls back to counted screens when no plan was declared', () => {
    const html = markup({ plan: [], slidesBuilt: 1 })
    expect(html).toContain('Screen 1')
    expect(html).toContain('SCREEN 2 OF 2')
  })

  it('announces itself politely to assistive technology', () => {
    const html = markup()
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })
})
