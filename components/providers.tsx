'use client'

import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}><TooltipProvider>{children}<Toaster position="bottom-right" richColors closeButton theme="light" /></TooltipProvider></SWRConfig>
}
