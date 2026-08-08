/**
 * Turns the two prose streams of a run (assistant text and reasoning) into a short
 * queue of finished sentences plus the sentence currently being written.
 *
 * The band shows only the last few sentences, so the run panel never grows a scroll
 * area. Splitting on sentence boundaries — rather than slicing a character window —
 * is also what keeps two steps from colliding into "…gentle Noah set.Art direction".
 */

export type NarrationSource = 'text' | 'reasoning'

export type NarrationSentence = {
  id: number
  source: NarrationSource
  text: string
}

export type NarrationState = {
  /** Finished sentences, oldest first. Never longer than `visibleSentenceCount`. */
  sentences: NarrationSentence[]
  /** The sentence still being streamed, or '' between sentences. */
  pending: string
  pendingSource: NarrationSource | null
  nextId: number
}

export const VISIBLE_SENTENCE_COUNT = 3

export const createNarrationState = (): NarrationState => ({
  sentences: [],
  pending: '',
  pendingSource: null,
  nextId: 1,
})

const SENTENCE_END = /[.!?…]/

/**
 * A boundary is a terminator followed by whitespace, or directly by an opening
 * character. Models stream sentences back to back without a space surprisingly
 * often, and treating that as a boundary is what repairs the run-together text.
 */
const isBoundary = (value: string, index: number): boolean => {
  const char = value[index]
  if (char === undefined || !SENTENCE_END.test(char)) return false

  const previous = value[index - 1]
  const next = value[index + 1]
  if (next === undefined) return false
  // Decimals and version numbers ("1.5", "v2.0") are not sentence ends.
  if (char === '.' && previous !== undefined && /\d/.test(previous) && /\d/.test(next)) return false
  // Ellipses: only the final dot of a run terminates.
  if (SENTENCE_END.test(next)) return false

  return /\s/.test(next) || /[A-ZÄÖÜ«"„(]/.test(next)
}

const ABBREVIATIONS = ['z.B', 'bzw', 'usw', 'etc', 'vgl', 'ca', 'ggf', 'Nr', 'Abb', 'ff', 'px', 'vs']

const endsWithAbbreviation = (sentence: string): boolean => {
  const trimmed = sentence.trimEnd().replace(/[.!?…]+$/, '')
  if (ABBREVIATIONS.some((abbreviation) => trimmed.endsWith(abbreviation))) return true
  // A single trailing letter is an initial or the tail of a segmented abbreviation
  // ("z.B.", "u.a.") — never the end of a sentence.
  return /(^|[\s.])[A-Za-zÄÖÜäöü]$/.test(trimmed)
}

const appendSentence = (
  state: NarrationState,
  source: NarrationSource,
  text: string,
): NarrationState => {
  const trimmed = text.trim()
  if (!trimmed) return state
  const sentences = [...state.sentences, { id: state.nextId, source, text: trimmed }]
  return {
    ...state,
    sentences: sentences.slice(-VISIBLE_SENTENCE_COUNT),
    nextId: state.nextId + 1,
  }
}

/**
 * Folds one streamed delta into the state. `source` switches whenever the run moves
 * between assistant prose and reasoning; an unfinished sentence from the previous
 * source is flushed so the two never merge into one line.
 */
export const appendNarrationDelta = (
  state: NarrationState,
  source: NarrationSource,
  delta: string,
): NarrationState => {
  if (!delta) return state

  let next: NarrationState = state
  if (state.pendingSource !== null && state.pendingSource !== source && state.pending.trim()) {
    next = { ...appendSentence(state, state.pendingSource, state.pending), pending: '', pendingSource: null }
  }

  let buffer = (next.pendingSource === source ? next.pending : '') + delta
  let cursor = 0
  while (cursor < buffer.length) {
    if (isBoundary(buffer, cursor)) {
      const candidate = buffer.slice(0, cursor + 1)
      if (!endsWithAbbreviation(candidate)) {
        next = appendSentence(next, source, candidate)
        buffer = buffer.slice(cursor + 1)
        cursor = 0
        continue
      }
    }
    cursor += 1
  }

  return { ...next, pending: buffer.replace(/^\s+/, ''), pendingSource: source }
}

/** Flushes a trailing sentence that never received its terminator (end of a run). */
export const flushNarration = (state: NarrationState): NarrationState => {
  if (!state.pending.trim() || state.pendingSource === null) {
    return { ...state, pending: '', pendingSource: null }
  }
  return {
    ...appendSentence(state, state.pendingSource, state.pending),
    pending: '',
    pendingSource: null,
  }
}

/** Ends one provider-defined prose segment without merging it into the next one. */
export const finishNarrationSegment = (
  state: NarrationState,
  source: NarrationSource,
): NarrationState => state.pendingSource === source ? flushNarration(state) : state

const MARKDOWN_EMPHASIS = /(^|[\s([{"'“‘])(\*\*|__|~~|[*_`])(?=\S)([\s\S]*?\S)\2(?=$|[\s)\]}"'”’.,!?;:])/g

/** The run band is plain text even when a provider formats its summaries as Markdown. */
export const toPlainNarrationText = (value: string): string => value
  .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
  .replace(/(^|\n)\s{0,3}(?:#{1,6}|[-+])\s+/g, '$1')
  .replace(MARKDOWN_EMPHASIS, '$1$3')
  .replace(/\s+/g, ' ')
  .trim()

/** The lines the band renders: finished sentences plus the live one, oldest first. */
export const getNarrationLines = (state: NarrationState): NarrationSentence[] => {
  const live: NarrationSentence[] = state.pending.trim() && state.pendingSource !== null
    ? [{ id: state.nextId, source: state.pendingSource, text: state.pending.trim() }]
    : []
  return [...state.sentences, ...live]
    .map((sentence) => ({ ...sentence, text: toPlainNarrationText(sentence.text) }))
    .filter((sentence) => sentence.text.length > 0)
    .slice(-VISIBLE_SENTENCE_COUNT)
}
