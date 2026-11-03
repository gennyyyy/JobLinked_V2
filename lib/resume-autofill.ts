export type ResumeDetails = Partial<Record<'name' | 'email' | 'phone' | 'headline' | 'address' | 'barangay' | 'education' | 'experience' | 'skills', string>>

const headings = /^(?:professional\s+)?(?:summary|profile|objective|education(?:\s*(?:&|and)\s*training)?|academic background|qualifications|(?:work\s+|professional\s+|employment\s+)?experience|employment history|(?:technical\s+|key\s+|core\s+)?skills|skills\s*(?:&|and)\s*competencies|certifications|references|contact(?: information)?|personal (?:details|information)|languages|projects|achievements)\s*:?$/i

export function parseResumeText(text: string, barangays: readonly string[] = []): ResumeDetails {
  const lines = text.replace(/\r/g, '').split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean)
  const details: ResumeDetails = {}
  const section = (pattern: RegExp, limit: number) => {
    const index = lines.findIndex(line => pattern.test(line))
    if (index === -1) return undefined
    const content: string[] = []
    for (const line of lines.slice(index + 1)) {
      if (headings.test(line)) break
      content.push(line)
    }
    return content.join('\n').slice(0, limit).trim() || undefined
  }
  const nameLabel = lines.find(line => /^(?:full\s+)?name\s*:/i.test(line))
  const name = nameLabel?.replace(/^(?:full\s+)?name\s*:\s*/i, '') || lines.slice(0, 4).find(line =>
    !headings.test(line) && !/resume|curriculum vitae|@|https?:|\d|[:|]/i.test(line) &&
    /^[\p{L}][\p{L}\s.,'’-]+$/u.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 6,
  )
  if (name) details.name = name.slice(0, 100)
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  if (email) details.email = email
  const mobile = text.match(/(?:\+63[\s()-]*9|\b09)(?:[\s()-]*\d){9}\b/)?.[0]
  if (mobile) details.phone = mobile.replace(/[^\d+]/g, '')
  const address = lines.find(line => /^(?:home\s+|street\s+)?address\s*:/i.test(line))?.replace(/^(?:home\s+|street\s+)?address\s*:\s*/i, '')
  if (address) details.address = address.slice(0, 200)
  const location = address || lines.slice(0, 12).join(' ')
  const barangay = [...barangays].sort((a, b) => b.length - a.length).find(value => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[\\s,])${escaped}(?=$|[\\s,.])`, 'i').test(location)
  })
  if (barangay) details.barangay = barangay
  details.education = section(/^(?:education(?:\s*(?:&|and)\s*training)?|academic background|qualifications)\s*:?$/i, 300)
  details.experience = section(/^(?:(?:work\s+|professional\s+|employment\s+)?experience|employment history)\s*:?$/i, 1500)
  const skills = section(/^(?:(?:technical\s+|key\s+|core\s+)?skills|skills\s*(?:&|and)\s*competencies)\s*:?$/i, 600)
  if (skills) details.skills = [...new Set(skills.split(/[\n,;•|]+/).map(skill => skill.replace(/^[-*]\s*/, '').trim()).filter(Boolean))].join(', ').slice(0, 300)
  const headline = lines.find(line => /^(?:headline|job title)\s*:/i.test(line))?.replace(/^(?:headline|job title)\s*:\s*/i, '')
  if (headline) details.headline = headline.slice(0, 150)
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value)) as ResumeDetails
}

export async function readResume(file: File): Promise<string> {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Choose a non-empty resume up to 5 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  let text = ''
  if (extension === 'txt') {
    text = await file.text()
  } else if (extension === 'docx') {
    const mammoth = await import('mammoth')
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  } else if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    // Keep the bundled worker and pinned pdfjs-dist version in sync.
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker-6.4.299.min.mjs'
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    try {
      const document = await task.promise
      if (document.numPages > 20) throw new Error('Use a resume of 20 pages or fewer.')
      const pages: string[] = []
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number)
        const content = await page.getTextContent()
        pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''))
      }
      text = pages.join('\n')
    } finally {
      await task.destroy()
    }
  } else {
    throw new Error('Choose a PDF, DOCX, or TXT resume. Convert older DOC files to DOCX first.')
  }
  if (!text.trim() || !/[\p{L}]{2}/u.test(text)) throw new Error('No readable text found. Scanned PDFs need OCR first; try a text-based PDF, DOCX, or TXT.')
  if (text.length > 200000) throw new Error('This document contains too much text. Choose a shorter resume.')
  return text
}
