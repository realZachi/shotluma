import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveElementText } from '../editor/element-utils'
import { ElementContent } from './CanvasElementView'
import type { TextElement } from '../types'

describe('CanvasElementView - localization', () => {
  const textElement: TextElement = {
    id: 'el-1',
    type: 'text',
    x: 10,
    y: 10,
    width: 80,
    rotation: 0,
    opacity: 1,
    text: 'Hello World',
    color: '#000000',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    translations: {
      'es-ES': { text: 'Hola Mundo' },
      'ja-JP': { text: 'こんにちは世界' },
    },
  }

  it('resolves default text when locale is en-US or undefined', () => {
    expect(resolveElementText(textElement).text).toBe('Hello World')
    expect(resolveElementText(textElement, 'en-US').text).toBe('Hello World')
  })

  it('resolves localized text when translation exists for locale', () => {
    expect(resolveElementText(textElement, 'es-ES').text).toBe('Hola Mundo')
    expect(resolveElementText(textElement, 'ja-JP').text).toBe('こんにちは世界')
  })

  it('falls back to default text when translation is missing for locale', () => {
    expect(resolveElementText(textElement, 'fr-FR').text).toBe('Hello World')
  })

  it('renders localized text via ElementContent', () => {
    const defaultHtml = renderToStaticMarkup(<ElementContent element={textElement} />)
    expect(defaultHtml).toContain('Hello World')

    const esHtml = renderToStaticMarkup(<ElementContent element={textElement} locale="es-ES" />)
    expect(esHtml).toContain('Hola Mundo')

    const jaHtml = renderToStaticMarkup(<ElementContent element={textElement} locale="ja-JP" />)
    expect(jaHtml).toContain('こんにちは世界')
  })
})
