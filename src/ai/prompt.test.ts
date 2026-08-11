import { describe, expect, it } from 'vitest'
import { OVERLAY_ASSET_BUDGET } from './overlay-asset-prompt'
import { buildInstructions, buildUserMessage } from './prompt'

describe('AI prompt language', () => {
  it('requires English canvas copy and completion summaries', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain(
      'Write all on-canvas copy (headlines, supporting text, labels) in English',
    )
    expect(instructions).toContain(
      'reply in English with a short 2-3 sentence summary',
    )
    expect(instructions).not.toContain(
      'in the same language the user used to describe their app',
    )
  })

  it('keeps the English completion requirement in edit mode', () => {
    const instructions = buildInstructions({ targetSlideId: 'slide-1' })

    expect(instructions).toContain(
      'reply in English with a short 1-2 sentence summary',
    )
  })
})

describe('AI prompt branding', () => {
  it('requires logo placement via add_image in generate mode', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('When a logo asset is provided, incorporate it with add_image')
    expect(instructions).toContain('Do not place the logo asset inside a device frame')
  })

  it('includes app name and logo asset in the user message', () => {
    const message = buildUserMessage(
      'A calm habit tracker',
      [{ assetId: 'upload-1', name: 'home.png' }],
      { appName: 'Habitly', logoAssetId: 'upload-logo' },
    )

    expect(message).toContain('App name: Habitly')
    expect(message).toContain('App logo asset id: upload-logo')
    expect(message).toContain('use add_image with this id')
    expect(message).toContain('upload-1 — home.png')
  })
})

describe('AI prompt copywriting', () => {
  it('frames screenshots as ads selling one idea per slide', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Screenshots are advertisements, not documentation')
    expect(instructions).toContain('One idea per headline')
    expect(instructions).toContain('3-5 words per line')
    expect(instructions).toContain('break lines intentionally')
  })

  it('teaches the three headline types with benefit-first examples', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Paint a moment')
    expect(instructions).toContain('State an outcome')
    expect(instructions).toContain('Kill a pain')
    expect(instructions).toContain('"Track habits and stay motivated" -> "Keep your streak alive"')
  })

  it('keeps the copywriting rules available in edit mode', () => {
    const instructions = buildInstructions({ targetSlideId: 'slide-1' })

    expect(instructions).toContain('One idea per headline')
  })
})

describe('AI prompt story arc', () => {
  it('assigns slide roles from hero to feature wall in generate mode', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('STORY ARC')
    expect(instructions).toContain('the ONLY slide most people ever see')
    expect(instructions).toContain('differentiator')
    expect(instructions).toContain('one core feature per slide, most important first')
    expect(instructions).toContain('feature wall')
  })

  it('concentrates social proof on the hero slide', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('concentrate it here instead of sprinkling it across the set')
  })

  it('does not impose the story arc on single-slide edits', () => {
    const instructions = buildInstructions({ targetSlideId: 'slide-1' })

    expect(instructions).not.toContain('STORY ARC')
  })
})

describe('AI prompt thumbnail test', () => {
  it('requires judging each preview at store-thumbnail size', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('THUMBNAIL TEST')
    expect(instructions).toContain('~160px-wide store thumbnail')
    expect(instructions).toContain('in under one second')
  })
})

describe('AI prompt density', () => {
  it('keeps density inside the phone and sparsity outside', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Density lives inside the phone, sparsity outside')
  })
})

describe('AI prompt space usage', () => {
  it('demands the composition fill the tall canvas and flags dead zones as defects', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('FILL THE FRAME')
    expect(instructions).toContain('span roughly the whole height')
    expect(instructions).toContain(
      'a large contiguous zone of the canvas (roughly a quarter or more) as bare background',
    )
    expect(instructions).toContain(
      'does it actually fill the tall canvas or is a large stretch of it sitting empty',
    )
  })
})

describe('AI prompt icons', () => {
  it('instructs the model to use Hugeicons and never emoji', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('add_icon')
    expect(instructions).toContain('NEVER use emoji')
    expect(instructions).toContain('Hugeicons')
  })

  it('includes the no-emoji rule in edit mode', () => {
    const instructions = buildInstructions({ targetSlideId: 'slide-1' })

    expect(instructions).toContain('NEVER use emoji')
  })
})

describe('AI prompt overlay assets', () => {
  it('omits overlay asset guidance unless enabled', () => {
    const instructions = buildInstructions()

    expect(instructions).not.toContain('Overlay assets (gpt-image-2)')
    expect(instructions).not.toContain('create_overlay_asset')
  })

  it('teaches the chroma-key workflow when overlay assets are enabled', () => {
    const instructions = buildInstructions({ enableOverlayAssets: true })

    expect(instructions).toContain('Overlay assets (gpt-image-2) — ENABLED for this run')
    expect(instructions).toContain('create_overlay_asset')
    expect(instructions).toContain('remove_asset_background')
    expect(instructions).toContain('#FF00FF')
    expect(instructions).toContain('Do NOT generate:')
  })

  it('treats the opt-in as an instruction to actually generate', () => {
    const instructions = buildInstructions({ enableOverlayAssets: true })

    expect(instructions).toContain('Treat that as an instruction, not permission')
    expect(instructions).toContain('expected to contain at least one generated cutout')
  })

  it('states the per-run generation budget and the 1-2 target', () => {
    const instructions = buildInstructions({ enableOverlayAssets: true })

    expect(instructions).toContain(`Hard budget of ${OVERLAY_ASSET_BUDGET} create_overlay_asset calls per run`)
    expect(instructions).toContain('Aim for 1-2 generated subjects')
    expect(instructions).toContain('One call per subject')
  })

  it('times generation to the concept phase when building a new set', () => {
    const instructions = buildInstructions({ enableOverlayAssets: true })

    expect(instructions).toContain('Pick the subject during step 2')
  })

  it('lets a pure text or layout edit skip generation in edit mode', () => {
    const instructions = buildInstructions({ targetSlideId: 'slide-1', enableOverlayAssets: true })

    expect(instructions).toContain('purely about text, sizing, color, or position')
    expect(instructions).toContain('Decide before you start editing')
    expect(instructions).not.toContain('Pick the subject during step 2')
  })
})

describe('AI prompt batching', () => {
  it('instructs the model to batch independent tool calls in one turn', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Batch your tool calls')
    expect(instructions).toContain('Never add one element per turn')
    expect(instructions).toContain('Request every tool call whose inputs you already know TOGETHER in one turn')
  })

  it('tells the model to batch whole slide composition, repairs, and final renders', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Build a whole slide in one turn')
    expect(instructions).toContain('Batch each repair round')
    expect(instructions).toContain('every update_element fix plus the follow-up render_slide_preview')
    expect(instructions).toContain('Emit each slide\'s full planned composition as ONE batched turn')
  })

  it('creates the declared screen plan in one batched first turn', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('FIRST tool turn, call declare_plan and add_slides together')
    expect(instructions).toContain('add_slides creates every planned screen at once')
  })

  it('does not ask for a screen plan in edit mode', () => {
    expect(buildInstructions({ targetSlideId: 'slide-1' })).not.toContain('declare_plan')
  })

  it('does not repeat previews that already passed', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('do not re-render screens that already passed their preview')
    expect(instructions).toContain('request another preview only if a later change affected that screen')
  })

  it('frames inspect_slide as rarely needed since mutations return boxes and warnings', () => {
    const instructions = buildInstructions()

    expect(instructions).toContain('Mutation results return the changed element\'s box')
    expect(instructions).toContain('inspect_slide is almost never worth its own turn')
  })
})
