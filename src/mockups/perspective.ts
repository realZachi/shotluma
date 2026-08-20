import type { PhotoMockupDefinition } from './catalog'

const PLACEHOLDER_SCREEN_WIDTH = 139.2

type PerspectiveMappingOptions = {
  width: number
  height: number
  definition: PhotoMockupDefinition
  hasScreenshot: boolean
}

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])

  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      const candidate = augmented[row]?.[column] ?? 0
      const currentPivot = augmented[pivot]?.[column] ?? 0
      if (Math.abs(candidate) > Math.abs(currentPivot)) pivot = row
    }
    const columnRow = augmented[column]
    const pivotRow = augmented[pivot]
    if (!columnRow || !pivotRow) return null
    augmented[column] = pivotRow
    augmented[pivot] = columnRow
    const activeRow = pivotRow
    const divisor = activeRow[column]
    if (divisor === undefined || Math.abs(divisor) < 1e-10) return null
    for (let item = column; item <= size; item += 1) {
      activeRow[item] = (activeRow[item] ?? 0) / divisor
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const targetRow = augmented[row]
      if (!targetRow) return null
      const factor = targetRow[column] ?? 0
      for (let item = column; item <= size; item += 1) {
        targetRow[item] = (targetRow[item] ?? 0) - factor * (activeRow[item] ?? 0)
      }
    }
  }

  return augmented.map((row) => row[size] ?? 0)
}

export const createPerspectiveMapping = ({
  width,
  height,
  definition,
  hasScreenshot,
}: PerspectiveMappingOptions) => {
  // HTML slides are laid out at export size and scaled down as one surface.
  // Giving real screenshots a source plane as wide as the unscaled mockup
  // prevents Chromium from enlarging a small intermediate texture first.
  const sourceWidth = hasScreenshot
    ? Math.max(PLACEHOLDER_SCREEN_WIDTH, width)
    : PLACEHOLDER_SCREEN_WIDTH
  const sourceHeight = sourceWidth / definition.sourceAspectRatio
  const source: [number, number][] = [
    [0, 0],
    [sourceWidth, 0],
    [sourceWidth, sourceHeight],
    [0, sourceHeight],
  ]
  const target: [number, number][] = definition.screenQuad.map(
    (point) => [point.x * width, point.y * height],
  )
  const equations: number[][] = []
  const values: number[] = []

  for (let index = 0; index < 4; index += 1) {
    const sourcePoint = source[index]
    const targetPoint = target[index]
    if (!sourcePoint || !targetPoint) {
      return { transform: 'none', sourceWidth, sourceHeight }
    }
    const [x, y] = sourcePoint
    const [targetX, targetY] = targetPoint
    equations.push([x, y, 1, 0, 0, 0, -targetX * x, -targetX * y])
    values.push(targetX)
    equations.push([0, 0, 0, x, y, 1, -targetY * x, -targetY * y])
    values.push(targetY)
  }

  const solved = solveLinearSystem(equations, values)
  if (!solved) return { transform: 'none', sourceWidth, sourceHeight }
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = solved
  return {
    transform: `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`,
    sourceWidth,
    sourceHeight,
  }
}
