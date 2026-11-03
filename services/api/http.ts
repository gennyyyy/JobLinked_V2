export class ApiError extends Error { constructor(message: string, public status: number) { super(message); this.name = 'ApiError' } }

export function createRestClient(baseUrl: string, getAccessToken: () => Promise<string | undefined> = async () => undefined) {
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken()
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, { ...options, credentials: 'include', headers: { Accept: 'application/json', ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new ApiError(error.message ?? 'The request could not be completed.', response.status) }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}

export const REST_ENDPOINTS = { login: '/auth/login', register: '/auth/register', logout: '/auth/logout', forgotPassword: '/auth/forgot-password', resetPassword: '/auth/reset-password', profile: '/me/profile', resumes: '/me/resumes', jobs: '/jobs', applications: '/applications', employers: '/employers', accreditation: '/accreditations', notifications: '/notifications', reports: '/reports', announcements: '/announcements', uploadUrl: '/files/signed-upload-url' } as const
