import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { EditorCanvas } from './EditorCanvas'
import type { Slide } from '../types'
import type { ComponentProps } from 'react'

vi.mock('./ui/button', () => ({
  Button: ({ variant, size, ...props }: ComponentProps<'button'> & {
    variant?: string
    size?: string
  }) => <button data-variant={variant} data-size={size} {...props} />,
}))

const slides: Slide[] = [
  {
    id: 'slide-one',
    name: 'Hook',
    background: { type: 'solid', color1: '#ffffff', color2: '#ffffff', angle: 0 },
    elements: [],
  },
  {
    id: 'slide-two',
    name: 'Story',
    background: { type: 'solid', color1: '#ffffff', color2: '#ffffff', angle: 0 },
    elements: [],
  },
]

describe('EditorCanvas spanning mockups', () => {
  it('renders a non-interactive ghost of a spanning mockup on the neighboring screen', () => {
    const spanningSlides: Slide[] = [
      {
        id: 'slide-one',
        name: 'Hook',
        background: { type: 'solid', color1: '#ffffff', color2: '#ffffff', angle: 0 },
        elements: [{
          id: 'device-1',
          type: 'device',
          x: 60,
          y: 18,
          width: 70,
          rotation: -8,
          opacity: 1,
          deviceStyle: 'iphone-17-a',
          screenTheme: 'coral',
          tiltX: 0,
          tiltY: 0,
          shadow: 55,
          spansScreens: true,
        }],
      },
      {
        id: 'slide-two',
        name: 'Story',
        background: { type: 'solid', color1: '#ffffff', color2: '#ffffff', angle: 0 },
        elements: [],
      },
    ]
    const markup = renderToStaticMarkup(
      <EditorCanvas
        slides={spanningSlides}
        activeSlideId="slide-one"
        selectedElementIds={[]}
        exporting={false}
        zoom={1}
        onSetActiveSlide={() => undefined}
        onSelectElement={() => undefined}
        onUpdateElements={() => undefined}
        onCommitText={() => undefined}
        onCheckpoint={() => undefined}
        onAddSlide={() => undefined}
        onDuplicateSlide={() => undefined}
        onDeleteSlide={() => undefined}
        onMoveSlide={() => undefined}
        onEditSlideWithAi={() => undefined}
        onGenerateWithAi={() => undefined}
      />,
    )
    const root = document.createElement('div')
    root.innerHTML = markup

    expect(root.querySelectorAll('#artboard-slide-one .canvas-item--span-ghost').length).toBe(0)
    const ghost = root.querySelector<HTMLElement>('#artboard-slide-two .canvas-item--span-ghost')
    expect(ghost).not.toBeNull()
    expect(ghost?.style.left).toBe('-40%')
    expect(ghost?.style.transform).toBe('rotate(-8deg)')
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')
    expect(ghost?.hasAttribute('data-element-id')).toBe(false)
  })
})

describe('EditorCanvas screen actions', () => {
  it('groups AI editing with the other contextual screen actions', () => {
    const markup = renderToStaticMarkup(
      <EditorCanvas
        slides={slides}
        activeSlideId="slide-one"
        selectedElementIds={[]}
        exporting={false}
        zoom={1}
        onSetActiveSlide={() => undefined}
        onSelectElement={() => undefined}
        onUpdateElements={() => undefined}
        onCommitText={() => undefined}
        onCheckpoint={() => undefined}
        onAddSlide={() => undefined}
        onDuplicateSlide={() => undefined}
        onDeleteSlide={() => undefined}
        onMoveSlide={() => undefined}
        onEditSlideWithAi={() => undefined}
        onGenerateWithAi={() => undefined}
      />,
    )
    const root = document.createElement('div')
    root.innerHTML = markup
    const actionGroups = root.querySelectorAll('.artboard-screen-actions')

    expect(actionGroups.length).toBe(2)
    for (const group of actionGroups) {
      expect(group.querySelectorAll('button').length).toBe(5)
    }

    const aiAction = root.querySelector('[aria-label="Edit Hook with AI"]')
    expect(aiAction?.parentElement).toBe(actionGroups.item(0))
  })

  it('allows deleting the last remaining screen', () => {
    const markup = renderToStaticMarkup(
      <EditorCanvas
        slides={slides.slice(0, 1)}
        activeSlideId="slide-one"
        selectedElementIds={[]}
        exporting={false}
        zoom={1}
        onSetActiveSlide={() => undefined}
        onSelectElement={() => undefined}
        onUpdateElements={() => undefined}
        onCommitText={() => undefined}
        onCheckpoint={() => undefined}
        onAddSlide={() => undefined}
        onDuplicateSlide={() => undefined}
        onDeleteSlide={() => undefined}
        onMoveSlide={() => undefined}
        onEditSlideWithAi={() => undefined}
        onGenerateWithAi={() => undefined}
      />,
    )
    const root = document.createElement('div')
    root.innerHTML = markup

    const deleteAction = root.querySelector('[aria-label="Delete screen"]')
    expect(deleteAction).not.toBeNull()
    expect(deleteAction?.hasAttribute('disabled')).toBe(false)
  })

  it('offers blank and AI creation actions when no screens remain', () => {
    const markup = renderToStaticMarkup(
      <EditorCanvas
        slides={[]}
        activeSlideId=""
        selectedElementIds={[]}
        exporting={false}
        zoom={1}
        onSetActiveSlide={() => undefined}
        onSelectElement={() => undefined}
        onUpdateElements={() => undefined}
        onCommitText={() => undefined}
        onCheckpoint={() => undefined}
        onAddSlide={() => undefined}
        onDuplicateSlide={() => undefined}
        onDeleteSlide={() => undefined}
        onMoveSlide={() => undefined}
        onEditSlideWithAi={() => undefined}
        onGenerateWithAi={() => undefined}
      />,
    )
    const root = document.createElement('div')
    root.innerHTML = markup

    expect(root.querySelector('#editor-empty-state-title')?.textContent)
      .toBe('Your canvas is empty')
    expect(root.querySelector('.editor-empty-state-phone')).not.toBeNull()
    expect(root.querySelector('.editor-empty-state-phone-island')).not.toBeNull()
    expect(root.querySelector('.editor-empty-state-artboard-plus')).toBeNull()
    expect(Array.from(root.querySelectorAll('button')).map((button) => button.textContent.trim()))
      .toEqual(['Generate with AI', 'Blank screen'])
  })
})
