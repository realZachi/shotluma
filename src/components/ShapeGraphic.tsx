import { shapeAspectRatio } from '../shapes'
import type { ShapeElement } from '../types'
import type { CSSProperties } from 'react'

const filledShape = (element: ShapeElement) => ({
  fill: element.color,
  stroke: element.strokeWidth ? element.strokeColor ?? '#171713' : 'none',
  strokeWidth: element.strokeWidth ?? 0,
  strokeLinejoin: 'round' as const,
})

export const ShapeGraphic = ({ element, className = '' }: { element: ShapeElement; className?: string }) => {
  const shadow = element.shadow ?? 0
  const style = {
    aspectRatio: shapeAspectRatio[element.shape],
    filter: shadow > 0
      ? `drop-shadow(0 ${Math.max(1, shadow * 0.035)}px ${Math.max(2, shadow * 0.1)}px rgba(0, 0, 0, ${Math.min(0.38, shadow * 0.004)}))`
      : undefined,
  } as CSSProperties
  const fill = filledShape(element)
  const lineWidth = Math.max(2, element.strokeWidth ?? 6)

  return (
    <svg
      className={`shape-vector shape-vector--${element.shape}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {element.shape === 'circle' && <circle cx="50" cy="50" r="45" {...fill} />}
      {element.shape === 'square' && <rect x="7" y="7" width="86" height="86" {...fill} />}
      {element.shape === 'rounded-square' && <rect x="7" y="7" width="86" height="86" rx="22" {...fill} />}
      {element.shape === 'pill' && <rect x="3" y="28" width="94" height="44" rx="22" {...fill} />}
      {element.shape === 'triangle' && <polygon points="50,6 95,91 5,91" {...fill} />}
      {element.shape === 'diamond' && <polygon points="50,3 97,50 50,97 3,50" {...fill} />}
      {element.shape === 'star' && <polygon points="50,3 61,35 95,35 68,55 78,89 50,69 22,89 32,55 5,35 39,35" {...fill} />}
      {element.shape === 'burst' && (
        <polygon
          points="50,2 58,21 73,7 74,28 94,19 83,38 99,46 79,53 93,70 72,66 72,88 57,73 49,98 41,76 25,91 26,69 5,79 17,60 0,51 21,45 6,28 28,32 27,10 43,25"
          {...fill}
        />
      )}
      {element.shape === 'spark' && <path d="M50 2C54 31 68 46 98 50C68 54 54 69 50 98C46 69 32 54 2 50C32 46 46 31 50 2Z" {...fill} />}
      {element.shape === 'blob' && <path d="M84 18C96 31 91 52 85 70C79 88 61 98 43 93C25 89 7 76 8 56C9 36 22 12 43 7C58 3 73 7 84 18Z" {...fill} />}
      {element.shape === 'arch' && <path d="M11 94V51C11 23 28 6 50 6C72 6 89 23 89 51V94H67V52C67 38 60 29 50 29C40 29 33 38 33 52V94H11Z" {...fill} />}
      {element.shape === 'ring' && <circle cx="50" cy="50" r="38" fill="none" stroke={element.color} strokeWidth={lineWidth + 5} />}
      {element.shape === 'line' && <path d="M5 50H95" fill="none" stroke={element.color} strokeWidth={lineWidth} strokeLinecap="round" />}
      {element.shape === 'arrow' && <path d="M7 50H82M62 27L85 50L62 73" fill="none" stroke={element.color} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />}
      {element.shape === 'wave' && <path d="M2 54C14 24 26 24 38 54S62 84 74 54S88 24 98 50" fill="none" stroke={element.color} strokeWidth={lineWidth} strokeLinecap="round" />}
      {element.shape === 'hexagon' && <polygon points="73,11 27,11 5,50 27,89 73,89 95,50" {...fill} />}
      {element.shape === 'chevron' && <polygon points="20,10 45,10 80,50 45,90 20,90 55,50" {...fill} />}
      {element.shape === 'speech-bubble' && (
        <path
          d="M21,8 L79,8 A16,16 0 0 1 95,24 L95,54 A16,16 0 0 1 79,70 L42,70 L22,92 L22,70 L21,70 A16,16 0 0 1 5,54 L5,24 A16,16 0 0 1 21,8 Z"
          {...fill}
        />
      )}
      {element.shape === 'checkmark' && <path d="M18 52L40 74L84 26" fill="none" stroke={element.color} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}
