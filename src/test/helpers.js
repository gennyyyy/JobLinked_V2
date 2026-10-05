// Creates a thenable query builder that resolves to result.
// Chainable methods return the builder; then makes it awaitable.
export function qb(result) {
  const builder = {}
  const chainable = ['select', 'eq', 'insert', 'update', 'delete', 'order', 'range', 'or', 'ilike', 'in', 'not', 'lt', 'gte', 'lte', 'neq', 'is', 'like']
  for (const method of chainable) {
    builder[method] = () => builder
  }
  builder.maybeSingle = () => Promise.resolve(result)
  builder.single = () => Promise.resolve(result)
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

// Creates a mock supabase client. Configure per-test via the returned fns.
export function mockSupabase() {
  const fromMock = vi.fn()
  const authMock = {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  const storageMock = {
    from: vi.fn(() => ({
      upload: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
    })),
  }
  const rpcMock = vi.fn()

  const supabase = {
    from: fromMock,
    auth: authMock,
    storage: storageMock,
    rpc: rpcMock,
  }

  return { supabase, fromMock, authMock, storageMock, rpcMock }
}
