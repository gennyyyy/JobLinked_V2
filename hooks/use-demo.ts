'use client'

import useSWR from 'swr'
import { DEMO_QUERY_KEY } from '@/constants'
import { demoApi } from '@/services/mock'
import { createInitialState } from '@/services/mock/fixtures'

const initialState = createInitialState()
export function useDemo() {
  const { data = initialState, error, isLoading } = useSWR(DEMO_QUERY_KEY, () => demoApi.getState(), { fallbackData: initialState, revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60000 })
  const user = data.users.find(u => u.id === data.sessionUserId) ?? null
  const seeker = data.seekers.find(s => s.id === user?.id)
  const employer = data.employers.find(e => e.userId === user?.id)
  return { state: data, user, seeker, employer, ready: !isLoading, error, api: demoApi }
}
