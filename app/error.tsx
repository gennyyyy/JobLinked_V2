'use client'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main-content" className="page-container py-16"><EmptyState title="Let’s try that again." description="This demo page could not load. Your browser’s sample workflow data has not been intentionally cleared." action={<Button onClick={reset}>Reload this view</Button>} /></main> }
