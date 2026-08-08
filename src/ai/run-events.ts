import type { PlannedScreen } from './run-plan'

export type AiRunEvent =
  | { type: 'status'; message: string }
  | { type: 'tool'; name: string; detail: string }
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'narration-boundary'; source: 'text' | 'reasoning' }
  | { type: 'plan'; screens: PlannedScreen[] }
  | { type: 'slide-started'; index: number }
  | { type: 'done'; summary: string; slidesCreated: number }
  | { type: 'error'; message: string }
