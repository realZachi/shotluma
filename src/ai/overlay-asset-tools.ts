import { generateImage, tool } from 'ai'
import { z } from 'zod'
import { fileToDataUrl } from '../utils'
import { ASSET_CHROMA_KEY_HEX } from './chroma-key'
import {
  OVERLAY_ASSET_BUDGET,
  OVERLAY_ASSET_SIZE_MAP,
  buildOverlayAssetPrompt,
  type OverlayAssetSize,
} from './overlay-asset-prompt'
import { getAiProviderKey } from './provider-config'
import { removeChromaKeyBackground } from './remove-chroma-key-background'
import {
  assetNotFoundMessage,
  notFound,
  type ToolContext,
} from './tool-context'

/**
 * A padded cutout clears well over half the frame. Far less means the backdrop was not a
 * flat key, so the "transparent" asset is really the original image with a few holes.
 */
const MIN_CLEARED_PERCENT = 25

const dataUrlToBase64 = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return dataUrl
  return dataUrl.slice(comma + 1)
}

// Upload sources are object URLs backed by stored Blobs (data URLs only as a
// storage fallback), so provider payloads fetch the bytes back before encoding.
const sourceToBase64 = async (src: string): Promise<string> => {
  if (src.startsWith('data:')) return dataUrlToBase64(src)
  const blob = await (await fetch(src)).blob()
  return dataUrlToBase64(await fileToDataUrl(blob))
}

const sanitizeAssetName = (name: string): string => {
  const trimmed = name.trim().replace(/[^\w.\- ]+/g, '').slice(0, 64)
  return trimmed.length > 0 ? trimmed : 'overlay-asset'
}

type OverlayAssetToolResult =
  | {
    ok: true
    assetId: string
    name: string
    chromaKey: typeof ASSET_CHROMA_KEY_HEX
    nextStep: string
    /** Remaining gpt-image-2 calls in this run. Only set by create_overlay_asset. */
    generationsLeft?: number
    /** Share of pixels made fully transparent, e.g. "62%". Only set by remove_asset_background. */
    backgroundCleared?: string
    warning?: string
    image: string
    mediaType: 'image/png'
  }
  | { ok: false; error: string }

/**
 * Send the summary as text plus the image itself, so the model can judge the cutout
 * without the raw base64 payload leaking into the text channel.
 */
const toAssetModelOutput = (output: OverlayAssetToolResult) => {
  if (!output.ok) return { type: 'text' as const, value: JSON.stringify(output) }
  const { image, mediaType, ...summary } = output
  return {
    type: 'content' as const,
    value: [
      { type: 'text' as const, text: JSON.stringify(summary) },
      {
        type: 'file' as const,
        mediaType,
        data: { type: 'data' as const, data: image },
      },
    ],
  }
}

const resolveReferenceImages = async (
  controller: ToolContext['controller'],
  referenceAssetIds: string[] | undefined,
): Promise<{ ok: true; images: string[] } | { ok: false; error: string }> => {
  const images: string[] = []
  for (const assetId of referenceAssetIds ?? []) {
    const src = controller.getAssetSrc(assetId)
    if (!src) return notFound(assetNotFoundMessage(assetId))
    try {
      images.push(await sourceToBase64(src))
    } catch {
      return notFound(assetNotFoundMessage(assetId))
    }
  }
  return { ok: true, images }
}

const generateChromaKeyedOverlay = async (options: {
  apiKey: string
  prompt: string
  referenceImages: string[]
  size: OverlayAssetSize
  quality: 'low' | 'medium' | 'high'
  abortSignal?: AbortSignal
}): Promise<{ dataUrl: string } | { ok: false; error: string }> => {
  try {
    const { createOpenAI } = await import('@ai-sdk/openai')
    const openai = createOpenAI({ apiKey: options.apiKey })
    const fullPrompt = buildOverlayAssetPrompt(options.prompt)

    const { image } = await generateImage({
      model: openai.image('gpt-image-2'),
      prompt: options.referenceImages.length > 0
        ? { text: fullPrompt, images: options.referenceImages }
        : fullPrompt,
      size: OVERLAY_ASSET_SIZE_MAP[options.size],
      providerOptions: {
        openai: {
          quality: options.quality,
          background: 'opaque',
          outputFormat: 'png',
        },
      },
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    })

    const mediaType = image.mediaType || 'image/png'
    return { dataUrl: `data:${mediaType};base64,${image.base64}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Overlay asset generation failed: ${message}` }
  }
}

const cutoutAssetName = (
  controller: ToolContext['controller'],
  assetId: string,
  name: string | undefined,
): string => {
  const sourceName = controller.snapshot().assets.find((asset) => asset.id === assetId)?.name
  const fallback = sourceName ? sourceName.replace(/\.png$/i, '') : 'overlay-asset'
  const baseName = sanitizeAssetName(name ?? fallback)
  return `${baseName.replace(/-cutout$/i, '')}-cutout.png`
}

export const createOverlayAssetTools = (
  { controller, emit }: ToolContext,
  options?: { abortSignal?: AbortSignal },
) => {
  let generationsUsed = 0

  const createOverlayAsset = tool({
    description: `Generate ONE cutout-ready overlay graphic with OpenAI gpt-image-2 and register it as an upload asset. The user explicitly turned this capability on for this run and expects to see a generated element in the result.

USE FOR: decorative or product-specific elements that sit ON TOP of a screenshot composition via add_image — badges, stickers, illustrations, mascots, props, extracted UI fragments, custom marks.
DO NOT USE FOR: full mockups, device frames (use add_device), complete app screens, slide backgrounds (use set_slide_background), or anything add_shape / add_icon / add_text already covers well. Never use it to invent a screenshot of the user's app.

HOW OFTEN: aim for 1-2 subjects per run. Each call is slow and paid (roughly 15-40s), with a hard limit of ${OVERLAY_ASSET_BUDGET} generations per run. Generate a subject ONCE and reuse the resulting cutout across slides with add_image (vary size, rotation, opacity) instead of generating variants of the same thing. Retry an unusable subject at most once.

WHEN: decide on the subject early — after the design concept is clear, before you lay out the individual slides — so the same cutout can be planned into several slides.

TRANSPARENCY: gpt-image-2 cannot emit transparency, so this tool forces a flat ${ASSET_CHROMA_KEY_HEX} chroma-key backdrop. You MUST call remove_asset_background on the returned assetId before add_image.

PROMPTING: describe ONLY the subject — one object, its material, style, colors, lighting. Never mention backgrounds, transparency, canvases, or layout; the tool appends the chroma-key constraints. Keep magenta/pink out of the subject itself, it would be keyed away. When extracting or matching something from a user screenshot, pass that screenshot's asset id in referenceAssetIds.`,
    inputSchema: z.object({
      prompt: z.string().min(1).describe(
        'Subject-only description of one overlay element, in English. Name the object, material, style, colors and lighting. No background, transparency, layout or slide instructions.',
      ),
      name: z.string().optional().describe(
        'Short filename-style label for the new asset (e.g. "spark-badge"). Defaults to overlay-asset.',
      ),
      referenceAssetIds: z.array(z.string()).max(4).optional().describe(
        'Optional uploaded screenshot/logo asset ids to attach as visual references (e.g. extract a UI chip from a screenshot, or match brand colors). Max 4.',
      ),
      size: z.enum(['square', 'portrait', 'landscape']).optional().describe(
        'Output aspect. Defaults to square, which suits almost every overlay. Use portrait/landscape only for clearly elongated subjects.',
      ),
      quality: z.enum(['low', 'medium', 'high']).optional().describe(
        'gpt-image-2 quality. Defaults to medium. Use high only for a hero element the user will look at closely; high is noticeably slower.',
      ),
    }),
    execute: async ({
      prompt,
      name,
      referenceAssetIds,
      size,
      quality,
    }): Promise<OverlayAssetToolResult> => {
      const apiKey = getAiProviderKey('openai')
      if (!apiKey) {
        return {
          ok: false,
          error: 'OpenAI API key missing. Add an OpenAI key in API keys to generate overlay assets.',
        }
      }

      if (generationsUsed >= OVERLAY_ASSET_BUDGET) {
        return {
          ok: false,
          error: `Overlay asset budget spent (${OVERLAY_ASSET_BUDGET} gpt-image-2 calls per run). Reuse an already generated cutout with add_image, or build the element from add_shape / add_icon / add_text.`,
        }
      }

      const references = await resolveReferenceImages(controller, referenceAssetIds)
      if (!references.ok) return references

      emit({ tool: 'create_overlay_asset' })
      generationsUsed += 1

      const generated = await generateChromaKeyedOverlay({
        apiKey,
        prompt,
        referenceImages: references.images,
        size: size ?? 'square',
        quality: quality ?? 'medium',
        ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
      })
      if ('ok' in generated) return generated

      const assetName = `${sanitizeAssetName(name ?? 'overlay-asset')}.png`
      const assetId = controller.addAsset({ name: assetName, src: generated.dataUrl })

      return {
        ok: true,
        assetId,
        name: assetName,
        chromaKey: ASSET_CHROMA_KEY_HEX,
        nextStep: `This image still has its ${ASSET_CHROMA_KEY_HEX} backdrop. Call remove_asset_background with assetId "${assetId}" now, and place that result — not this asset — with add_image.`,
        generationsLeft: OVERLAY_ASSET_BUDGET - generationsUsed,
        image: dataUrlToBase64(generated.dataUrl),
        mediaType: 'image/png',
      }
    },
    toModelOutput: ({ output }) => toAssetModelOutput(output),
  })

  const removeAssetBackground = tool({
    description: `Strip the flat ${ASSET_CHROMA_KEY_HEX} chroma-key backdrop from a create_overlay_asset image and register the result as a NEW transparent PNG asset.

WHEN: immediately after every create_overlay_asset call, before add_image. Placing the raw generated asset would put a magenta block on the slide. This runs in-browser (Canvas, no network call, no cost) and does not count against the generation budget.

ONLY on assets produced by create_overlay_asset. On a normal screenshot or logo it would erase any magenta pixels and leave the rest opaque.

CHECK THE RESULT: the transparent image comes back together with backgroundCleared, the share of pixels that actually became transparent. A clean padded cutout clears well over half the frame; a low number or a warning field means the backdrop was not a flat key and the asset is unusable. Look at the image too — if part of the subject was erased, do not place it. Either regenerate the subject with stronger contrast against magenta (that spends one generation) or fall back to shapes/icons.`,
    inputSchema: z.object({
      assetId: z.string().describe('Asset id returned by create_overlay_asset (the chroma-keyed image, not a user upload).'),
      name: z.string().optional().describe(
        'Optional label for the transparent asset. Defaults to the source name with "-cutout".',
      ),
    }),
    execute: async ({
      assetId,
      name,
    }): Promise<OverlayAssetToolResult> => {
      const src = controller.getAssetSrc(assetId)
      if (!src) return notFound(assetNotFoundMessage(assetId))

      emit({ tool: 'remove_asset_background' })

      try {
        const { dataUrl: transparentDataUrl, stats } = await removeChromaKeyBackground(src)
        const assetName = cutoutAssetName(controller, assetId, name)
        const nextAssetId = controller.addAsset({ name: assetName, src: transparentDataUrl })
        const clearedPercent = Math.round(stats.clearedRatio * 100)

        return {
          ok: true,
          assetId: nextAssetId,
          name: assetName,
          chromaKey: ASSET_CHROMA_KEY_HEX,
          nextStep: `Transparent cutout ready. Place it with add_image using assetId "${nextAssetId}", then verify with render_slide_preview. Reuse this id on other slides instead of generating again.`,
          backgroundCleared: `${clearedPercent}%`,
          ...(clearedPercent < MIN_CLEARED_PERCENT
            ? {
                warning: `Only ${clearedPercent}% of the image became transparent, so the generated backdrop was probably not a flat key. Do not place this asset — regenerate the subject and insist on a uniform ${ASSET_CHROMA_KEY_HEX} background, or build the element from shapes and icons instead.`,
              }
            : {}),
          image: dataUrlToBase64(transparentDataUrl),
          mediaType: 'image/png',
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, error: `Background removal failed: ${message}` }
      }
    },
    toModelOutput: ({ output }) => toAssetModelOutput(output),
  })

  return {
    create_overlay_asset: createOverlayAsset,
    remove_asset_background: removeAssetBackground,
  }
}
