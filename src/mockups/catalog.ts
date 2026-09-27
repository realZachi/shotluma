import androidPhoneOverlay from '../assets/mockups/android-phone.png'
import ipadProLandscapeOverlay from '../assets/mockups/ipad-pro-landscape.png'
import ipadProPortraitOverlay from '../assets/mockups/ipad-pro-portrait.png'
import iphone17AOverlay from '../assets/mockups/iphone-17-a.webp'
import iphone17BOverlay from '../assets/mockups/iphone-17-b.webp'
import iphone17COverlay from '../assets/mockups/iphone-17-c.webp'
import iphone17DOverlay from '../assets/mockups/iphone-17-d.webp'
import iphone17EOverlay from '../assets/mockups/iphone-17-e.webp'
import iphone17FOverlay from '../assets/mockups/iphone-17-f.webp'
import tiltedHandOverlay from '../assets/mockups/tilted-hand.webp'
import type { DeviceElement } from '../types'

export type DeviceStyle = DeviceElement['deviceStyle']

export type DevicePlacement = Pick<DeviceElement, 'x' | 'y' | 'width' | 'rotation'>

export type PhotoMockupDefinition = {
  overlay: string
  canvasAspectRatio: number
  sourceAspectRatio: number
  defaultPlacement: DevicePlacement
  screenMask?: {
    top: number
    right: number
    bottom: number
    left: number
    cornerRadius: number
  }
  screenQuad: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ]
}

const iphoneScreenAspectRatio = 1206 / 2622
const iphone17ScreenMask = {
  top: 6 / 1532,
  right: 16 / 723,
  bottom: 13 / 1532,
  left: 7 / 723,
  cornerRadius: 100 / 723,
}

const ipadProPortraitScreenMask = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  cornerRadius: 24 / 515,
}

const ipadProLandscapeScreenMask = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  cornerRadius: 26 / 763,
}

const androidPhoneScreenMask = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  cornerRadius: 38 / 339,
}

export const photoMockups: Record<DeviceStyle, PhotoMockupDefinition> = {
  'iphone-17-a': {
    overlay: iphone17AOverlay,
    canvasAspectRatio: 766 / 1574,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: 18, y: 27, width: 64, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: 0.0365535248, y: 0.0152477764 },
      { x: 0.9804177546, y: 0.0152477764 },
      { x: 0.9804177546, y: 0.9885641677 },
      { x: 0.0365535248, y: 0.9885641677 },
    ],
  },
  'iphone-17-b': {
    overlay: iphone17BOverlay,
    canvasAspectRatio: 1188 / 2466,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: 14, y: 20, width: 70, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: 0.0517982245, y: 0.011638699 },
      { x: 0.9829549348, y: 0.0180340754 },
      { x: 0.9816691591, y: 0.9885904108 },
      { x: 0.0597211036, y: 0.994080568 },
    ],
  },
  'iphone-17-c': {
    overlay: iphone17COverlay,
    canvasAspectRatio: 1917 / 1722,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: -2, y: 44, width: 104, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: -0.0135055412, y: 0.2561793345 },
      { x: 0.3785134379, y: -0.0184953089 },
      { x: 1.0205608029, y: 0.6848975445 },
      { x: 0.6197227467, y: 0.9851055403 },
    ],
  },
  'iphone-17-d': {
    overlay: iphone17DOverlay,
    canvasAspectRatio: 1951 / 1673,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: -4, y: 44, width: 108, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: 0.6108035531, y: -0.0158730201 },
      { x: 1.0154430061, y: 0.2070138297 },
      { x: 0.4062368155, y: 0.9757253166 },
      { x: -0.0132040862, y: 0.7142332742 },
    ],
  },
  'iphone-17-e': {
    overlay: iphone17EOverlay,
    canvasAspectRatio: 1803 / 1549,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: -4, y: 45, width: 108, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: -0.0126050405, y: 0.1922883987 },
      { x: 0.4141827534, y: -0.0133224214 },
      { x: 1.0148008116, y: 0.7275228106 },
      { x: 0.5675096065, y: 0.9719397697 },
    ],
  },
  'iphone-17-f': {
    overlay: iphone17FOverlay,
    canvasAspectRatio: 1673 / 1664,
    sourceAspectRatio: iphoneScreenAspectRatio,
    defaultPlacement: { x: 0, y: 40, width: 100, rotation: 0 },
    screenMask: iphone17ScreenMask,
    screenQuad: [
      { x: 0.5181051797, y: 0.0010636078 },
      { x: 0.9920755055, y: 0.0438789118 },
      { x: 0.4700476861, y: 0.9595336225 },
      { x: -0.0149162126, y: 0.8998103536 },
    ],
  },
  'tilted-hand': {
    overlay: tiltedHandOverlay,
    canvasAspectRatio: 4409 / 3728,
    sourceAspectRatio: 1392 / 3017,
    defaultPlacement: { x: -7, y: 38, width: 114, rotation: 0 },
    screenQuad: [
      { x: (1615.4964150338822 - 1591) / 4409, y: (789.6513174904904 - 443) / 3728 },
      { x: (2735.824384213138 - 1591) / 4409, y: (439.4457765110928 - 443) / 3728 },
      { x: (4143.016848821205 - 1591) / 4409, y: (2860.8861566024875 - 443) / 3728 },
      { x: (3033.7505437034424 - 1591) / 4409, y: (3366.6787577701266 - 443) / 3728 },
    ],
  },
  'ipad-pro-portrait': {
    overlay: ipadProPortraitOverlay,
    canvasAspectRatio: 578 / 800,
    sourceAspectRatio: 515 / 738,
    defaultPlacement: { x: 14, y: 16, width: 72, rotation: 0 },
    screenMask: ipadProPortraitScreenMask,
    screenQuad: [
      { x: 31 / 578, y: 32 / 800 },
      { x: 546 / 578, y: 32 / 800 },
      { x: 546 / 578, y: 770 / 800 },
      { x: 31 / 578, y: 770 / 800 },
    ],
  },
  'ipad-pro-landscape': {
    overlay: ipadProLandscapeOverlay,
    canvasAspectRatio: 800 / 575,
    sourceAspectRatio: 763 / 537,
    defaultPlacement: { x: 8, y: 22, width: 84, rotation: 0 },
    screenMask: ipadProLandscapeScreenMask,
    screenQuad: [
      { x: 17 / 800, y: 20 / 575 },
      { x: 780 / 800, y: 20 / 575 },
      { x: 780 / 800, y: 557 / 575 },
      { x: 17 / 800, y: 557 / 575 },
    ],
  },
  'android-phone': {
    overlay: androidPhoneOverlay,
    canvasAspectRatio: 379 / 800,
    sourceAspectRatio: 339 / 761,
    defaultPlacement: { x: 17, y: 22, width: 66, rotation: 0 },
    screenMask: androidPhoneScreenMask,
    screenQuad: [
      { x: 19 / 379, y: 20 / 800 },
      { x: 358 / 379, y: 20 / 800 },
      { x: 358 / 379, y: 781 / 800 },
      { x: 19 / 379, y: 781 / 800 },
    ],
  },
}

export const deviceOptions: { id: DeviceStyle; label: string; kind: 'photo'; preview: string }[] = [
  { id: 'iphone-17-a', label: '17 Pro · Upright', kind: 'photo', preview: iphone17AOverlay },
  { id: 'iphone-17-b', label: '17 Pro · Front', kind: 'photo', preview: iphone17BOverlay },
  { id: 'iphone-17-c', label: '17 Pro · Right', kind: 'photo', preview: iphone17COverlay },
  { id: 'iphone-17-d', label: '17 Pro · Left', kind: 'photo', preview: iphone17DOverlay },
  { id: 'iphone-17-e', label: '17 Pro · Flat', kind: 'photo', preview: iphone17EOverlay },
  { id: 'iphone-17-f', label: '17 Pro · Leaning', kind: 'photo', preview: iphone17FOverlay },
  { id: 'tilted-hand', label: 'Hand · Tilted', kind: 'photo', preview: tiltedHandOverlay },
  { id: 'ipad-pro-portrait', label: 'iPad Pro · Portrait', kind: 'photo', preview: ipadProPortraitOverlay },
  { id: 'ipad-pro-landscape', label: 'iPad Pro · Landscape', kind: 'photo', preview: ipadProLandscapeOverlay },
  { id: 'android-phone', label: 'Android · Portrait', kind: 'photo', preview: androidPhoneOverlay },
]

export const getDevicePlacement = (style: DeviceStyle) => photoMockups[style].defaultPlacement
