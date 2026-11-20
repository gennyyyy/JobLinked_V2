import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATCHING_NAME,
  MODE_AI,
  MODE_STANDARD,
  MATCH_UNAVAILABLE,
  MATCHING_NOTICE,
  DIALOG_AI_NOTICE,
  matchModeLabel,
} from '../matching'

const SRC = join(globalThis.process.cwd(), 'src')

// Retired wording (2026-11-20 terminology decision): the product is
// "skills-based matching" and AI is only the optional re-ranker.
const RETIRED = [
  'AI matching is unavailable',
  'Standard matching · no AI',
  'AI ranking active',
  'It is not AI',
  'AI job matching',
]

function sourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(path, files)
    else if (/\.jsx?$/.test(entry.name)) files.push(path)
  }
  return files
}

describe('skills-based matching copy', () => {
  it('exports the canonical strings verbatim', () => {
    expect(MATCHING_NAME).toBe('Skills-based matching')
    expect(MODE_AI).toBe('AI-assisted ranking active')
    expect(MODE_STANDARD).toBe('Skills-based ranking')
    expect(MATCH_UNAVAILABLE).toBe('AI assistance is unavailable — showing skills-based ranking.')
    expect(MATCHING_NOTICE).toBe(
      'Ranked by exact skill matches, barangay, preferred position, and recency. When available, AI re-ranks the top results and writes the reasons. It is not a hiring score or a guarantee.',
    )
    expect(DIALOG_AI_NOTICE).toBe(
      'Your request may be processed by an AI provider to re-rank vacancies. Never include personal details; your name and resume are never sent.',
    )
  })

  it('maps the ranking mode to the canonical labels', () => {
    expect(matchModeLabel('ai')).toBe(MODE_AI)
    expect(matchModeLabel('deterministic')).toBe(MODE_STANDARD)
    expect(matchModeLabel(null)).toBe(MODE_STANDARD)
  })

  it('leaves no retired wording anywhere in src', () => {
    const files = sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(20)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const retired of RETIRED) {
        expect(source.includes(retired), `${file} still contains "${retired}"`).toBe(false)
      }
    }
  })
})
