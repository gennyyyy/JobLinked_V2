import { notFound } from 'next/navigation'
import { InfoPage } from '@/components/public/info-pages'
import { RecoveryPage } from '@/components/forms/auth-pages'
const titles: Record<string, string> = { about: 'About JobLinked', 'how-it-works': 'How It Works', 'peso-services': 'PESO Programs & Services', contact: 'Contact', faq: 'Frequently Asked Questions', privacy: 'Privacy Notice', terms: 'Draft Demo Terms', 'forgot-password': 'Account Recovery Preview', 'reset-password': 'Password Reset Preview' }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: titles[slug] ?? 'Page Not Found' } }
export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (!titles[slug]) notFound(); if (slug === 'forgot-password' || slug === 'reset-password') return <RecoveryPage reset={slug === 'reset-password'} />; return <InfoPage slug={slug} /> }
