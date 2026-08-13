export type LineNumberFormatter = (line: number) => number | ''

/**
 * Build CodeMirror's line-number formatter for Source Code mode.
 *
 * Line 1 stays labelled for every enabled interval so a short document still
 * has an obvious origin. Zero and invalid negative values mean "off".
 */
export const makeLineNumberFormatter = (frequency: number): LineNumberFormatter => {
  if (!Number.isFinite(frequency) || frequency <= 0) return () => ''

  return (line: number) => (line === 1 || line % frequency === 0 ? line : '')
}
