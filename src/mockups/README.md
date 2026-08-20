# Mockup asset specification

Browser code cannot render Photoshop files directly. A photo mockup is converted once during development and then stored as a small browser-ready bundle.

## Preferred Photoshop structure

- A separate Smart Object for the screen, ideally named `[SCREEN DESIGN]`.
- Device, frame, hand, reflections and shadows on layers outside the screen Smart Object.
- A removable background group so the final overlay can be exported with transparency.
- A portrait Smart Object whose aspect ratio matches the intended device screenshot.
- At least 1600 px width for the final transparent overlay.

The Smart Object transform must still be present. Its four transformed corners are used in this order:

1. top left
2. top right
3. bottom right
4. bottom left

## Runtime bundle

Each perspective mockup consists of:

- a transparent PNG or WebP overlay containing the frame, hand and lighting;
- the overlay's original aspect ratio;
- the flat screen's aspect ratio;
- four normalized screen corner coordinates in `catalog.ts`.

Example:

```ts
{
  overlay: tiltedHandOverlay,
  canvasAspectRatio: 4409 / 3728,
  sourceAspectRatio: 1392 / 3017,
  screenQuad: [topLeft, topRight, bottomRight, bottomLeft],
}
```

Shotluma calculates a projective `matrix3d` from these points. Uploaded screenshots are therefore distorted into the original Photoshop perspective instead of merely being rotated.

At runtime, real screenshots use a perspective source plane at least as wide as the rendered mockup. This matters for native-size HTML screens that are scaled down in the editor: it prevents the browser from enlarging a small intermediate texture before the outer scale is applied. Placeholder screens retain their fixed reference plane because their generated UI uses absolute CSS pixel sizes.

## What does not work

A single flattened JPG is not enough: the original screen cannot be removed cleanly and there are no reliable perspective coordinates. A flattened transparent PNG can be used only when the display area is already empty and its four corners are supplied manually.

Before adding third-party mockups, confirm that their license permits use in generated App Store artwork.
