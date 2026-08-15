export const AI_PROVIDER_ENV_VARIABLES = [
  'VITE_MOONSHOT_API_KEY',
  'VITE_GOOGLE_GENERATIVE_AI_API_KEY',
  'VITE_ALIBABA_API_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_ANTHROPIC_API_KEY',
  'VITE_XAI_API_KEY',
  'VITE_OPENCODE_API_KEY',
] as const

export type AiProviderEnvironmentVariable = typeof AI_PROVIDER_ENV_VARIABLES[number]

export const createClientProviderEnvironment = (
  environment: Record<string, string>,
  command: 'build' | 'serve',
): Record<AiProviderEnvironmentVariable, string> => {
  const values = {} as Record<AiProviderEnvironmentVariable, string>
  for (const variable of AI_PROVIDER_ENV_VARIABLES) {
    values[variable] = command === 'serve' ? (environment[variable]?.trim() ?? '') : ''
  }
  return values
}

export const createClientProviderDefinitions = (
  environment: Record<string, string>,
  command: 'build' | 'serve',
): Record<string, string> => {
  const values = createClientProviderEnvironment(environment, command)
  return Object.fromEntries(AI_PROVIDER_ENV_VARIABLES.map((variable) => [
    `import.meta.env.${variable}`,
    JSON.stringify(values[variable]),
  ]))
}
