export type SharePreviewPalette = {
  color1: string
  color2: string
}

type ColorBucket = {
  count: number
  red: number
  green: number
  blue: number
}

const EDGE_INSET_RATIO = 0.18
const MIN_SECONDARY_SHARE = 0.03
const MIN_SECONDARY_DISTANCE = 36
const QUANTIZATION_SHIFT = 4

const isEdgePixel = (x: number, y: number, width: number, height: number) => {
  const horizontalInset = Math.max(1, Math.ceil(width * EDGE_INSET_RATIO))
  const verticalInset = Math.max(1, Math.ceil(height * EDGE_INSET_RATIO))
  return x < horizontalInset
    || x >= width - horizontalInset
    || y < verticalInset
    || y >= height - verticalInset
}

const colorDistance = (left: ColorBucket, right: ColorBucket) => Math.hypot(
  left.red / left.count - right.red / right.count,
  left.green / left.count - right.green / right.count,
  left.blue / left.count - right.blue / right.count,
)

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0')

const bucketToHex = ({ red, green, blue, count }: ColorBucket) =>
  `#${toHex(red / count)}${toHex(green / count)}${toHex(blue / count)}`

const chooseSecondary = (primary: ColorBucket, buckets: ColorBucket[]) => {
  const minimumCount = Math.max(2, Math.ceil(primary.count * MIN_SECONDARY_SHARE))
  let best = primary
  let bestScore = 0
  for (const bucket of buckets) {
    if (bucket === primary || bucket.count < minimumCount) continue
    const distance = colorDistance(primary, bucket)
    const score = bucket.count * distance
    if (distance >= MIN_SECONDARY_DISTANCE && score > bestScore) {
      best = bucket
      bestScore = score
    }
  }
  return best
}

/**
 * Finds representative colors along a rendered screen's perimeter. Sampling
 * the perimeter favors the design surface over text, devices, and other focal
 * content in the middle of the artboard.
 */
export const deriveSharePreviewPalette = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): SharePreviewPalette | null => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null
  if (pixels.length < width * height * 4) return null

  const buckets = new Map<number, ColorBucket>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isEdgePixel(x, y, width, height)) continue
      const offset = (y * width + x) * 4
      const alpha = pixels[offset + 3] ?? 0
      if (alpha < 128) continue
      const red = pixels[offset] ?? 0
      const green = pixels[offset + 1] ?? 0
      const blue = pixels[offset + 2] ?? 0
      const key = ((red >> QUANTIZATION_SHIFT) << 8)
        | ((green >> QUANTIZATION_SHIFT) << 4)
        | (blue >> QUANTIZATION_SHIFT)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.red += red
        bucket.green += green
        bucket.blue += blue
      } else {
        buckets.set(key, { count: 1, red, green, blue })
      }
    }
  }

  const sorted = [...buckets.values()].sort((left, right) => right.count - left.count)
  const primary = sorted[0]
  if (!primary) return null
  const secondary = chooseSecondary(primary, sorted)
  return { color1: bucketToHex(primary), color2: bucketToHex(secondary) }
}
