import { describe, expect, it } from 'vitest'
import { makeLineNumberFormatter } from '@/util/sourceLineNumbers'

describe('makeLineNumberFormatter (#4908)', () => {
  it.each([5, 10, 20, 50])('labels line 1 and every %i lines', (frequency) => {
    const format = makeLineNumberFormatter(frequency)

    expect(format(1)).toBe(1)
    expect(format(frequency)).toBe(frequency)
    expect(format(frequency + 1)).toBe('')
    expect(format(frequency * 2)).toBe(frequency * 2)
  })

  it('labels every line when the frequency is 1', () => {
    const format = makeLineNumberFormatter(1)

    expect([1, 2, 3, 50].map(format)).toEqual([1, 2, 3, 50])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'hides every line for a disabled or invalid frequency (%s)',
    (frequency) => {
      const format = makeLineNumberFormatter(frequency)

      expect(format(1)).toBe('')
      expect(format(50)).toBe('')
    }
  )
})
