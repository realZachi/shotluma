import { describe, expect, it } from 'vitest'
import {
  appendNarrationDelta,
  createNarrationState,
  finishNarrationSegment,
  flushNarration,
  getNarrationLines,
  toPlainNarrationText,
  VISIBLE_SENTENCE_COUNT,
  type NarrationSource,
  type NarrationState,
} from './run-narration'

const stream = (deltas: [NarrationSource, string][]): NarrationState =>
  deltas.reduce(
    (state, [source, delta]) => appendNarrationDelta(state, source, delta),
    createNarrationState(),
  )

const texts = (state: NarrationState) => getNarrationLines(state).map((line) => line.text)

describe('appendNarrationDelta', () => {
  it('splits a stream into sentences across delta boundaries', () => {
    const state = stream([['text', 'Art direction is se'], ['text', 't. Building five slides.']])
    expect(texts(state)).toEqual(['Art direction is set.', 'Building five slides.'])
  })

  it('separates sentences that stream without a space between them', () => {
    const state = stream([['text', 'a gentle Noah set.Art direction is set.']])
    expect(texts(state)).toEqual(['a gentle Noah set.', 'Art direction is set.'])
  })

  it('keeps decimals and version numbers in one sentence', () => {
    const state = stream([['text', 'Line height goes to 1.1 now. Done.']])
    expect(texts(state)).toEqual(['Line height goes to 1.1 now.', 'Done.'])
  })

  it('does not split on common abbreviations', () => {
    const state = stream([['text', 'Accents z.B. clay purple stay. Next.']])
    expect(texts(state)).toEqual(['Accents z.B. clay purple stay.', 'Next.'])
  })

  it('treats an ellipsis as a single terminator', () => {
    const state = stream([['reasoning', 'Checking the canvas … Now building.']])
    expect(texts(state)).toEqual(['Checking the canvas …', 'Now building.'])
  })

  it('keeps only the last visible sentences', () => {
    const state = stream([['text', 'One. Two. Three. Four. Five.']])
    expect(texts(state)).toEqual(['Three.', 'Four.', 'Five.'])
    expect(texts(state)).toHaveLength(VISIBLE_SENTENCE_COUNT)
  })

  it('flushes an unfinished sentence when the source changes', () => {
    const state = stream([['reasoning', 'Weighing two layouts'], ['text', 'Building the hero now.']])
    expect(texts(state)).toEqual(['Weighing two layouts', 'Building the hero now.'])
  })

  it('tags each line with the stream it came from', () => {
    const state = stream([['text', 'Plan is set. '], ['reasoning', 'Headline collides.']])
    expect(getNarrationLines(state).map((line) => line.source)).toEqual(['text', 'reasoning'])
  })

  it('exposes the unfinished sentence as a live line', () => {
    const state = stream([['text', 'Done. Still writ']])
    expect(texts(state)).toEqual(['Done.', 'Still writ'])
    expect(state.pending).toBe('Still writ')
  })

  it('ignores empty deltas', () => {
    const state = stream([['text', 'Kept.'], ['text', '']])
    expect(texts(state)).toEqual(['Kept.'])
  })

  it('gives every line a stable unique key', () => {
    const state = stream([['text', 'One. Two. Three.']])
    const ids = getNarrationLines(state).map((line) => line.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps provider-defined summary parts as separate streamed lines', () => {
    const firstPart = stream([['reasoning', '**Planning the screenshot story**']])
    const nextPart = finishNarrationSegment(firstPart, 'reasoning')
    const finished = appendNarrationDelta(nextPart, 'reasoning', '**Choosing typography**')

    expect(texts(finished)).toEqual([
      'Planning the screenshot story',
      'Choosing typography',
    ])
  })

  it('does not finish a segment from another narration source', () => {
    const state = stream([['reasoning', 'Still reasoning']])

    expect(finishNarrationSegment(state, 'text')).toBe(state)
  })

  it('renders provider Markdown as compact plain narration', () => {
    expect(toPlainNarrationText('### **Planning**\n- [Six screens](https://example.com)'))
      .toBe('Planning Six screens')
  })

  it('preserves punctuation inside identifiers while removing paired emphasis', () => {
    expect(toPlainNarrationText('Using snake_case, --color_primary, and **bold text**.'))
      .toBe('Using snake_case, --color_primary, and bold text.')
  })
})

describe('flushNarration', () => {
  it('promotes a trailing sentence without a terminator', () => {
    const flushed = flushNarration(stream([['text', 'No terminator here']]))
    expect(texts(flushed)).toEqual(['No terminator here'])
    expect(flushed.pending).toBe('')
  })

  it('is a no-op when nothing is pending', () => {
    const flushed = flushNarration(stream([['text', 'Complete.']]))
    expect(texts(flushed)).toEqual(['Complete.'])
  })
})
