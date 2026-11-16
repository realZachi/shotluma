import { describe, expect, it } from 'vitest'
import {
  exportProjectJson,
  getProjectJsonFilename,
  parseProjectJson,
} from './project-file'
import type { SharedProjectPayload } from './share-link'

const sampleProject: SharedProjectPayload = {
  projectName: 'Fuel Tracker',
  slides: [
    {
      id: 'slide-1',
      name: 'Hero',
      background: {
        type: 'solid',
        color1: '#111116',
        color2: '#252435',
        angle: 135,
      },
      elements: [
        {
          id: 'text-1',
          type: 'text',
          x: 10,
          y: 10,
          width: 80,
          rotation: 0,
          opacity: 1,
          text: 'Track your\nfuel',
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'Geist',
          color: '#ffffff',
          align: 'center',
          lineHeight: 1.1,
          letterSpacing: -0.5,
        },
      ],
    },
  ],
  uploads: [
    {
      id: 'upload-1',
      name: 'shot.png',
      src: 'data:image/png;base64,iVBORw0KGgo=',
    },
  ],
}

describe('project-file', () => {
  it('builds a clean .shotluma.json filename', () => {
    expect(getProjectJsonFilename('Fuel Tracker App!')).toBe('fuel-tracker-app.shotluma.json')
    expect(getProjectJsonFilename('   ')).toBe('shotluma-project.shotluma.json')
  })

  it('round-trips a project through JSON export and import', async () => {
    const json = await exportProjectJson(sampleProject)
    const imported = parseProjectJson(json)

    expect(imported).toEqual(sampleProject)
  })

  it('rejects malformed or incompatible JSON', () => {
    expect(parseProjectJson('{not valid json')).toBeNull()
    expect(parseProjectJson(JSON.stringify({ v: 99, slides: [] }))).toBeNull()
    expect(parseProjectJson(JSON.stringify({ projectName: 'Missing version' }))).toBeNull()
  })

  it('strips unsafe image sources on import', () => {
    const json = JSON.stringify({
      v: 1,
      projectName: 'Untrusted',
      slides: [],
      uploads: [
        { id: 'bad', name: 'xss.png', src: 'javascript:alert(1)' },
        { id: 'ok', name: 'ok.png', src: 'data:image/png;base64,iVBORw0KGgo=' },
      ],
    })

    const imported = parseProjectJson(json)
    expect(imported?.uploads).toEqual([
      { id: 'bad', name: 'xss.png', src: '' },
      { id: 'ok', name: 'ok.png', src: 'data:image/png;base64,iVBORw0KGgo=' },
    ])
  })
})
