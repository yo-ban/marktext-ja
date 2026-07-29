import { describe, expect, it, vi } from 'vitest'
import iconv from 'iconv-lite'

// The ced→iconv mapping table translated ced's Japanese detections (SJS,
// EUC-JP via fallback, JIS) to UTF-8. Opening a Shift_JIS markdown file
// therefore decoded it as UTF-8 — mojibake — and the next save destroyed the
// file. Chinese (BIG5/GB) and Korean (KSC) were mapped correctly; only the
// Japanese entries were wrong.
//
// ced is mocked per test: the mapping from ced's answer to an iconv encoding
// is exactly the unit under test. Fixtures are real Shift_JIS / EUC-JP bytes
// produced by iconv-lite, and each test round-trips them through the decoder
// the detected name selects.
vi.mock('ced', () => ({ default: vi.fn() }))

const ced = vi.mocked((await import('ced')).default)
const { guessEncoding } = await import('main_renderer/filesystem/encoding')

const JAPANESE_TEXT = '# 見出し\n\n日本語のテスト。改行コードも含む。\n'

describe('guessEncoding — Japanese legacy encodings', () => {
  it('maps ced SJS to shiftjis and the bytes round-trip', () => {
    const buffer = iconv.encode(JAPANESE_TEXT, 'shiftjis')
    ced.mockReturnValue('SJS')

    const { encoding } = guessEncoding(buffer, true)

    expect(encoding).toBe('shiftjis')
    expect(iconv.decode(buffer, encoding)).toBe(JAPANESE_TEXT)
  })

  it('maps ced EUC-JP to eucjp and the bytes round-trip', () => {
    const buffer = iconv.encode(JAPANESE_TEXT, 'eucjp')
    ced.mockReturnValue('EUC-JP')

    const { encoding } = guessEncoding(buffer, true)

    expect(encoding).toBe('eucjp')
    expect(iconv.decode(buffer, encoding)).toBe(JAPANESE_TEXT)
  })

  it('never claims UTF-8 for a ced JIS detection (fail loudly, not mojibake)', () => {
    // iconv-lite cannot decode ISO-2022-JP. The mapping must not pretend the
    // file is UTF-8 — loadMarkdownFile rejects unsupported encodings, which
    // beats silently corrupting the file on the next save. (Real ISO-2022-JP
    // is 7-bit and never reaches ced; this pins the fail-safe.)
    const buffer = Buffer.from([0x1b, 0x24, 0x42, 0x93, 0xfa, 0x1b, 0x28, 0x42])
    ced.mockReturnValue('JIS')

    const { encoding } = guessEncoding(buffer, true)

    expect(encoding).not.toBe('utf8')
    expect(iconv.encodingExists(encoding)).toBe(false)
  })

  it('normalizes dashed fallback names (KOI8-R → koi8r), fixing the /-_/ typo', () => {
    // 'привет' in KOI8-R — invalid as UTF-8, so ced's answer stands.
    const buffer = Buffer.from([0xd0, 0xd2, 0xc9, 0xd7, 0xc5, 0xd4])
    ced.mockReturnValue('KOI8-R')

    const { encoding } = guessEncoding(buffer, true)

    expect(encoding).toBe('koi8r')
    expect(iconv.decode(buffer, encoding)).toBe('привет')
  })

  it('still prefers UTF-8 when the bytes are valid UTF-8, whatever ced says', () => {
    const buffer = Buffer.from(JAPANESE_TEXT, 'utf8')
    ced.mockReturnValue('SJS')

    expect(guessEncoding(buffer, true).encoding).toBe('utf8')
  })
})
