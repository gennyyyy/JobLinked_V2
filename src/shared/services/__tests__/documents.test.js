import { describe, it, expect } from 'vitest'
import { validateFile, latestAccByCompany } from '../documents'

const MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
}

describe('validateFile', () => {
  it('accepts PDF files', () => {
    expect(validateFile({ name: 'resume.pdf', size: 1024, type: MIME.pdf })).toBeNull()
  })
  it('accepts DOC files', () => {
    expect(validateFile({ name: 'resume.doc', size: 1024, type: MIME.doc })).toBeNull()
  })
  it('accepts DOCX files', () => {
    expect(validateFile({ name: 'resume.docx', size: 1024, type: MIME.docx })).toBeNull()
  })
  it('accepts PNG files', () => {
    expect(validateFile({ name: 'photo.png', size: 1024, type: MIME.png })).toBeNull()
  })
  it('accepts JPG files', () => {
    expect(validateFile({ name: 'photo.jpg', size: 1024, type: MIME.jpg })).toBeNull()
  })
  it('accepts JPEG files', () => {
    expect(validateFile({ name: 'photo.jpeg', size: 1024, type: MIME.jpg })).toBeNull()
  })
  it('rejects EXE files', () => {
    expect(validateFile({ name: 'virus.exe', size: 1024, type: 'application/x-msdownload' }))
      .toBe('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.')
  })
  it('rejects TXT files', () => {
    expect(validateFile({ name: 'notes.txt', size: 1024, type: 'text/plain' }))
      .toBe('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.')
  })
  it('rejects files over 5 MB', () => {
    expect(validateFile({ name: 'resume.pdf', size: 6 * 1024 * 1024, type: MIME.pdf }))
      .toBe('File must be 5 MB or smaller.')
  })
  it('accepts files exactly at 5 MB', () => {
    expect(validateFile({ name: 'resume.pdf', size: 5 * 1024 * 1024, type: MIME.pdf })).toBeNull()
  })
  it('is case-insensitive for extensions', () => {
    expect(validateFile({ name: 'RESUME.PDF', size: 1024, type: MIME.pdf })).toBeNull()
  })
  it('handles files with no extension', () => {
    expect(validateFile({ name: 'resume', size: 1024, type: '' }))
      .toBe('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.')
  })
  it('rejects valid extension but wrong MIME type', () => {
    expect(validateFile({ name: 'resume.pdf', size: 1024, type: 'text/plain' }))
      .toBe('Invalid file type.')
  })
  it('rejects missing MIME type', () => {
    expect(validateFile({ name: 'resume.pdf', size: 1024 }))
      .toBe('Invalid file type.')
  })
})

describe('latestAccByCompany', () => {
  it('returns the first (latest) accreditation per company when ordered by submitted_at desc', () => {
    const accs = [
      { id: 2, company_id: 'c1', status: 'approved', submitted_at: '2025-02-01' },
      { id: 1, company_id: 'c1', status: 'pending', submitted_at: '2025-01-01' },
      { id: 3, company_id: 'c2', status: 'pending', submitted_at: '2025-01-15' },
    ]
    const result = latestAccByCompany(accs)
    expect(result.c1.id).toBe(2)
    expect(result.c2.id).toBe(3)
  })
  it('returns empty object for empty array', () => {
    expect(latestAccByCompany([])).toEqual({})
  })
  it('returns empty object for null', () => {
    expect(latestAccByCompany(null)).toEqual({})
  })
  it('handles single accreditation', () => {
    const accs = [{ id: 1, company_id: 'c1', status: 'pending' }]
    expect(latestAccByCompany(accs).c1.id).toBe(1)
  })
})