/**
 * Every HTML screen renders into the same document, and models reuse the same
 * class names across screens of one set (.hero, .headline, …). Unscoped, the
 * newest screen's <style> rules restyle every previously built screen — which
 * looks exactly like the AI "rewriting" earlier screens. Wrapping each style
 * block in a prelude-less @scope pins its rules to the style element's parent,
 * i.e. this screen's own subtree.
 *
 * The `to (shotluma-device > *)` limit is a donut hole: the device placeholder
 * itself stays styleable (the model positions it via CSS), but the hydrated
 * mockup markup inside it is off limits for slide CSS.
 *
 * Export stays unaffected by the wrapper because html-to-image inlines
 * computed styles per element when cloning.
 */

// `body`, `html`, and `:root` cannot match inside a scoped subtree; models use
// them for full-screen backgrounds, so retarget them at the scope root.
const ROOT_SELECTOR_PATTERN = /(^|[\s,{}])(?:body|html|:root)\b/gi

// `html body` would become `:scope :scope`, which can never match because the
// scope root is not its own descendant — collapse root chains to one `:scope`.
const SCOPE_CHAIN_PATTERN = /:scope(?:\s*[>~+]?\s*:scope)+/g

export const rewriteRootSelectors = (css: string): string =>
  css.replace(ROOT_SELECTOR_PATTERN, '$1:scope').replace(SCOPE_CHAIN_PATTERN, ':scope')

export const scopeSlideStyles = (container: HTMLElement): void => {
  for (const style of Array.from(container.querySelectorAll('style'))) {
    const css = style.textContent
    if (css.trimStart().startsWith('@scope')) continue
    style.textContent = `@scope to (shotluma-device > *) {\n${rewriteRootSelectors(css)}\n}`
  }
}
