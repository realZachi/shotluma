export type LocaleDefinition = {
  code: string
  label: string
  nativeLabel: string
  flag: string
}

export const DEFAULT_LOCALE = 'en-US'

export const SUPPORTED_LOCALES: LocaleDefinition[] = [
  { code: 'en-US', label: 'English (US)', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'es-ES', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'ja-JP', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'de-DE', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr-FR', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'pt-BR', label: 'Portuguese (BR)', nativeLabel: 'Português', flag: '🇧🇷' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: '🇨🇳' },
  { code: 'ko-KR', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
  { code: 'it-IT', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
]

export const getLocaleDefinition = (code: string): LocaleDefinition => {
  return (
    SUPPORTED_LOCALES.find((l) => l.code === code) ?? {
      code,
      label: code,
      nativeLabel: code,
      flag: '🌐',
    }
  )
}
