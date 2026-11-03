import { LoginPage } from '@/components/forms/auth-pages'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Demo Login' }
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <LoginPage nextPath={next} /> }
