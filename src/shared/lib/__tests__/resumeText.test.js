import { describe, it, expect } from 'vitest'
import { joinPdfItems } from '../resumeText'

const Y = (y) => [1, 0, 0, 1, 72, y]

// Regression: the old extractor space-joined every pdfjs item, collapsing a
// page into one giant line (only global regexes survived). joinPdfItems must
// rebuild the visual lines from hasEOL / Y position.
describe('joinPdfItems', () => {
  it('keeps hasEOL-terminated runs on separate lines', () => {
    const items = [
      { str: 'Juan Dela Cruz', hasEOL: true, transform: Y(720) },
      { str: 'Email:', hasEOL: false, transform: Y(700) },
      { str: 'juan@example.com', hasEOL: true, transform: Y(700) },
      { str: 'Skills: Data Entry, Communication', hasEOL: true, transform: Y(680) },
    ]
    expect(joinPdfItems(items)).toBe(
      'Juan Dela Cruz\nEmail: juan@example.com\nSkills: Data Entry, Communication\n',
    )
  })

  it('splits lines on Y jumps even without hasEOL', () => {
    const items = [
      { str: 'Juan Dela Cruz', hasEOL: false, transform: Y(720) },
      { str: 'Santa Maria, Bulacan 3022', hasEOL: false, transform: Y(700) },
    ]
    expect(joinPdfItems(items)).toBe('Juan Dela Cruz\nSanta Maria, Bulacan 3022\n')
  })

  it('space-joins runs sharing one baseline', () => {
    const items = [
      { str: 'Blk 5 Lot 12,', hasEOL: false, transform: Y(700) },
      { str: 'Santa Maria,', hasEOL: false, transform: Y(700) },
      { str: 'Bulacan 3022', hasEOL: true, transform: Y(700) },
    ]
    expect(joinPdfItems(items)).toBe('Blk 5 Lot 12, Santa Maria, Bulacan 3022\n')
  })

  it('returns empty string for no items', () => {
    expect(joinPdfItems([])).toBe('')
  })
})
