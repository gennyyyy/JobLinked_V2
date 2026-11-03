'use client'
import { useState } from 'react'
import { toast } from 'sonner'

export function useAction() {
  const [pending, setPending] = useState(false)
  async function run<T>(action: () => Promise<T>, message?: string): Promise<T | undefined> {
    setPending(true)
    try { const result = await action(); if (message) toast.success(message); return result }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); return undefined }
    finally { setPending(false) }
  }
  return { pending, run }
}
