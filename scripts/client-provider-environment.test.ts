import { describe, expect, it } from 'vitest'
import {
  createClientProviderDefinitions,
  createClientProviderEnvironment,
} from './client-provider-environment'

const environment = {
  VITE_MOONSHOT_API_KEY: ' moonshot-public ',
  VITE_OPENAI_API_KEY: ' openai-public ',
  MOONSHOT_API_KEY: 'moonshot-private',
}

describe('client provider environment', () => {
  it('exposes only VITE provider keys to the local development server', () => {
    const values = createClientProviderEnvironment(environment, 'serve')

    expect(values.VITE_MOONSHOT_API_KEY).toBe('moonshot-public')
    expect(values.VITE_OPENAI_API_KEY).toBe('openai-public')
    expect(values.VITE_XAI_API_KEY).toBe('')
    expect(values.VITE_OPENCODE_API_KEY).toBe('')
    expect(values).not.toHaveProperty('MOONSHOT_API_KEY')
  })

  it('replaces every provider key with an empty value in production builds', () => {
    expect(createClientProviderEnvironment(environment, 'build')).toEqual({
      VITE_MOONSHOT_API_KEY: '',
      VITE_GOOGLE_GENERATIVE_AI_API_KEY: '',
      VITE_ALIBABA_API_KEY: '',
      VITE_OPENAI_API_KEY: '',
      VITE_ANTHROPIC_API_KEY: '',
      VITE_XAI_API_KEY: '',
      VITE_OPENCODE_API_KEY: '',
    })
    expect(createClientProviderDefinitions(environment, 'build')).toMatchObject({
      'import.meta.env.VITE_MOONSHOT_API_KEY': '""',
      'import.meta.env.VITE_OPENAI_API_KEY': '""',
    })
  })
})
