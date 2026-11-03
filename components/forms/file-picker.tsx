'use client'

import { useId, useState } from 'react'
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validFile, fileSize } from '@/lib/format'
import type { FileMetadata } from '@/types'

export function FilePicker({ label, value, onChange, compliance = false, category, error }: { label: string; value?: FileMetadata; onChange: (file: FileMetadata) => void; compliance?: boolean; category?: string; error?: string }) {
  const inputId = useId()
  const [fileError, setFileError] = useState('')
  const select = (file?: File) => { if (!file) return; const message = validFile(file, compliance); if (message) { setFileError(message); return } setFileError(''); onChange({ id: `file-${crypto.randomUUID()}`, name: file.name, size: file.size, type: file.type, addedAt: new Date().toISOString(), category }) }
  return <Field data-invalid={!!(error || fileError)}><FieldLabel htmlFor={inputId}>{label}</FieldLabel><div className="rounded-xl border border-dashed bg-muted/70 p-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); select(e.dataTransfer.files[0]) }}><div className="mb-4 flex items-center gap-3"><span className="soft-icon">{value ? <FileText className="size-5" /> : <UploadCloud className="size-5" />}</span><div className="min-w-0"><p className="truncate text-xs font-medium text-navy">{value?.name ?? 'Choose a sample file or drop it here'}</p><p className="mt-1 text-[10px] text-muted-foreground">{value ? `${fileSize(value.size)} · Metadata only` : `${compliance ? 'PDF, JPG, PNG' : 'PDF, DOC, DOCX'} · Up to 5 MB`}</p></div>{value && <CheckCircle2 className="ml-auto size-4 shrink-0 text-teal" />}</div><Input id={inputId} type="file" accept={compliance ? '.pdf,.jpg,.jpeg,.png' : '.pdf,.doc,.docx'} onChange={e => { select(e.target.files?.[0]); e.target.value = '' }} aria-invalid={!!(error || fileError)} /><Button type="button" variant="outline" className="mt-3" onClick={() => { setFileError(''); onChange({ id: `sample-${crypto.randomUUID()}`, name: category ? `${category.replaceAll(' ', '_')}_SAMPLE.pdf` : 'Demo_Resume_SAMPLE.pdf', size: 248000, type: 'application/pdf', addedAt: new Date().toISOString(), category }) }}>Use sample metadata</Button></div><FieldDescription>Use sample files only. No file contents are read, uploaded, or stored.</FieldDescription><FieldError>{fileError || error}</FieldError></Field>
}
