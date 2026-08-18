import { tool } from 'ai'
import { z } from 'zod'
import { sanitizeScreenHtml } from '../html-slide/sanitize'
import { settleFrames } from './measure'
import {
  getSlide,
  notFound,
  slideNotFoundMessage,
  type ToolContext,
} from './tool-context'

/** Upper bound on one screen's markup; far above any sane design, guards runaway data URLs. */
export const HTML_SCREEN_CHARACTER_LIMIT = 150_000

const htmlTooLarge = (length: number) => notFound(
  `The HTML is ${length} characters; the limit per screen is ${HTML_SCREEN_CHARACTER_LIMIT}. Remove inline data URLs or repeated markup and try again.`,
)

const notHtmlScreenMessage = (slideId: string) =>
  `Slide ${slideId} is a structured element screen, not an HTML screen. Its markup cannot be edited with the HTML tools.`

const sanitizedResult = (violations: string[]) =>
  violations.length > 0 ? { sanitizerWarnings: violations } : {}

const countOccurrences = (haystack: string, needle: string): number => {
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

export const createHtmlScreenTools = ({ controller, emit }: ToolContext) => {
  const addHtmlScreen = tool({
    description:
      'Create a new HTML screen and append it to the end of the project. Pass the complete markup for the whole screen, authored at 1290x2796 px, following the markup rules in your instructions. Returns the new slide id plus warnings for anything the sanitizer had to strip.',
    inputSchema: z.object({
      name: z.string().optional().describe('Screen name shown in the editor sidebar. Defaults to "Screen N".'),
      html: z.string().describe('Complete HTML body fragment for the screen (no <html>/<head>/<body> tags). Allowed markup only; disallowed markup is stripped and reported.'),
    }),
    execute: async ({ name, html }) => {
      if (html.length > HTML_SCREEN_CHARACTER_LIMIT) return htmlTooLarge(html.length)
      const sanitized = sanitizeScreenHtml(html)
      const slideId = controller.addHtmlSlide({
        ...(name !== undefined ? { name } : {}),
        html: sanitized.html,
      })
      emit({ tool: 'add_html_screen', slideId, x: 50, y: 16 })
      await settleFrames()
      return { ok: true, slideId, ...sanitizedResult(sanitized.violations) }
    },
  })

  const setScreenHtml = tool({
    description:
      'Replace the entire markup of an existing HTML screen. Use this for redesigns and any fix that touches more than one spot. Returns warnings for anything the sanitizer had to strip.',
    inputSchema: z.object({
      slideId: z.string(),
      html: z.string().describe('The complete replacement HTML body fragment for the screen.'),
    }),
    execute: async ({ slideId, html }) => {
      const slide = getSlide(controller, slideId)
      if (!slide) return notFound(slideNotFoundMessage(slideId))
      if (slide.kind !== 'html') return notFound(notHtmlScreenMessage(slideId))
      if (html.length > HTML_SCREEN_CHARACTER_LIMIT) return htmlTooLarge(html.length)
      const sanitized = sanitizeScreenHtml(html)
      controller.setSlideHtml(slideId, sanitized.html)
      emit({ tool: 'set_screen_html', slideId, x: 50, y: 30 })
      await settleFrames()
      return { ok: true, ...sanitizedResult(sanitized.violations) }
    },
  })

  const patchScreenHtml = tool({
    description:
      'Apply one small, targeted fix to an HTML screen by replacing one EXACT, UNIQUE occurrence of `find` with `replace`. Fails without changing anything when `find` is missing or ambiguous — include more surrounding markup to make it unique, or fall back to set_screen_html.',
    inputSchema: z.object({
      slideId: z.string(),
      find: z.string().min(1).describe('Exact substring of the current screen HTML. Must match exactly once.'),
      replace: z.string().describe('Replacement text for the matched substring. May be empty to delete it.'),
    }),
    execute: async ({ slideId, find, replace }) => {
      const slide = getSlide(controller, slideId)
      if (!slide) return notFound(slideNotFoundMessage(slideId))
      if (slide.kind !== 'html' || slide.html === undefined) return notFound(notHtmlScreenMessage(slideId))

      const occurrences = countOccurrences(slide.html, find)
      if (occurrences === 0) {
        return notFound('The find text does not occur in the screen\'s current HTML. Read the markup via get_canvas_state, or use set_screen_html for a full rewrite.')
      }
      if (occurrences > 1) {
        return notFound(`The find text occurs ${occurrences} times; it must match exactly once. Include more surrounding markup to make it unique.`)
      }

      const patched = slide.html.replace(find, replace)
      if (patched.length > HTML_SCREEN_CHARACTER_LIMIT) return htmlTooLarge(patched.length)
      const sanitized = sanitizeScreenHtml(patched)
      controller.setSlideHtml(slideId, sanitized.html)
      emit({ tool: 'patch_screen_html', slideId, x: 50, y: 40 })
      await settleFrames()
      return { ok: true, ...sanitizedResult(sanitized.violations) }
    },
  })

  return {
    add_html_screen: addHtmlScreen,
    set_screen_html: setScreenHtml,
    patch_screen_html: patchScreenHtml,
  }
}
