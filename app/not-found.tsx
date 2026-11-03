import { PublicShell } from '@/components/layout/public-shell'
import { EmptyState } from '@/components/shared'
export default function NotFound() { return <PublicShell><div className="page-container py-16"><EmptyState title="This page took a different path." description="The page may have moved or may not exist. There are still plenty of opportunities to explore." href="/jobs" label="Explore local jobs" /></div></PublicShell> }
