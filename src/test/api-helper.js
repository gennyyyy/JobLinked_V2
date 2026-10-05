
export function mockApi() {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    blob: vi.fn(),
  }
  return api
}
