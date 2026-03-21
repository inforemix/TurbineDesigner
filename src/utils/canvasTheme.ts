/** Read a CSS custom property from the document root. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export interface CanvasTheme {
  isLight: boolean
  bg: string        // canvas background (void)
  surface: string   // subtle grid / guides (deep)
  grid: string      // grid lines (border)
  textMuted: string // label text
  teal: string      // accent / curve color
  tealDim: string   // muted accent
}

/** Returns theme-aware colors for canvas 2D drawing.
 *  Reads live CSS variables so it always reflects the current theme. */
export function getCanvasTheme(): CanvasTheme {
  const isLight = document.documentElement.classList.contains('light')
  return {
    isLight,
    bg:       cssVar('--color-void'),
    surface:  cssVar('--color-deep'),
    grid:     cssVar('--color-border'),
    textMuted:cssVar('--color-text-muted'),
    teal:     cssVar('--color-teal'),
    tealDim:  cssVar('--color-teal-dim'),
  }
}
