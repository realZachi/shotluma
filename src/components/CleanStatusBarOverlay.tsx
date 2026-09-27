import { BatteryFull, Signal, Wifi01 } from './icons'

type CleanStatusBarProps = {
  time?: string | undefined
  theme?: 'dark' | 'light' | undefined
  showDynamicIsland?: boolean | undefined
  sourceWidth: number
  isAndroid?: boolean | undefined
}

export const CleanStatusBarOverlay = ({
  time,
  theme = 'light',
  showDynamicIsland = false,
  sourceWidth,
  isAndroid = false,
}: CleanStatusBarProps) => {
  const displayTime = time && time.trim() !== '' ? time.trim() : (isAndroid ? '10:00' : '9:41')
  const fontSize = Math.max(6, Math.round(sourceWidth * 0.038))
  const iconSize = Math.max(7, Math.round(sourceWidth * 0.036))
  const batteryWidth = Math.round(iconSize * 1.35)
  const padTop = Math.max(4, Math.round(sourceWidth * 0.028))
  const padX = Math.max(8, Math.round(sourceWidth * 0.065))
  const textColor = theme === 'dark' ? '#ffffff' : '#000000'

  return (
    <div
      className={`clean-status-bar clean-status-bar--${theme}`}
      style={{
        paddingTop: `${padTop}px`,
        paddingLeft: `${padX}px`,
        paddingRight: `${padX}px`,
        color: textColor,
        fontSize: `${fontSize}px`,
      }}
      data-testid="clean-status-bar"
    >
      <span className="clean-status-time">{displayTime}</span>

      {showDynamicIsland && (
        <span
          className="clean-status-island"
          style={{
            top: `${Math.round(padTop * 0.8)}px`,
            width: `${Math.round(sourceWidth * 0.28)}px`,
            height: `${Math.max(14, Math.round(sourceWidth * 0.072))}px`,
          }}
          aria-hidden="true"
        />
      )}

      <div className="clean-status-icons" style={{ gap: `${Math.max(3, Math.round(sourceWidth * 0.012))}px` }}>
        <Signal size={iconSize} />
        <Wifi01 size={iconSize} />
        <BatteryFull size={batteryWidth} />
      </div>
    </div>
  )
}
