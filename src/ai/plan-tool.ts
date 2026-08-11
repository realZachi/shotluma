import { tool } from 'ai'
import { z } from 'zod'
import { parsePlanInput } from './run-plan'
import type { ToolContext } from './tool-context'

/**
 * Lets the run announce its composition plan before building. The editor shows the
 * planned screens while they are still empty, which is the one thing the canvas
 * itself cannot communicate.
 */
export const createDeclarePlanTool = ({ emit }: ToolContext) => tool({
  description:
    'Announce the planned screen set. Call exactly once, immediately before add_slides in the same tool turn. It reports intent to the editor UI and creates nothing.',
  inputSchema: z.object({
    screens: z.array(z.object({
      name: z.string().describe('Short screen name shown in the editor, e.g. "Hero" or "Ritual". Max 40 characters.'),
      role: z.string().describe('The job this screen does in the story arc, in a few words, e.g. "strongest benefit".'),
    })).min(1).max(8).describe('The screens in build order, one entry per screen you intend to create.'),
  }),
  execute: async ({ screens }) => {
    const planned = parsePlanInput({ screens })
    emit({ tool: 'declare_plan' })
    return {
      ok: true as const,
      acknowledged: planned.length,
      note: 'Plan recorded for the editor UI. Build the screens in this order.',
    }
  },
})
