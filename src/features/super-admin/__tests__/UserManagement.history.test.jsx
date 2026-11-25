import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: vi.fn(),
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  listAuditLogs: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  assignCustomRole: vi.fn(),
  inviteUser: vi.fn(),
  resetUserPassword: vi.fn(),
  forceSignOut: vi.fn(),
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
  listSeekerEmployment: vi.fn(),
  listSeekerResumes: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

import { listUsers, listRoles, listAuditLogs } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

const USER = {
  id: 'u-1', full_name: 'Ada Lovelace', email: 'ada@cebu.ph', role: 'employer',
  status: 'active', created_at: '2026-02-02T00:00:00.000Z',
}
const ROLES = [{ id: 5, name: 'HR Officer', description: '', base_role: 'employer', permissions: [] }]
const CHANGE_ID = 'aa4f3b8e-2f1c-4b6e-9c1d-2e3f4a5b6c7d'
const REASON = 'Promoted after PESO review.'

const roleLog = ({ id = 11, details = {}, ...rest } = {}) => ({
  id,
  action: 'user.role.change',
  entity_id: 'u-1',
  user_id: 'admin-9',
  actor_name: 'Admin One',
  created_at: '2026-02-02T00:00:00.000Z',
  details: { from: 'employer', to: 'job-seeker', reason: REASON, ...details },
  ...rest,
})
const tagLog = ({ id = 12, details = {}, ...rest } = {}) => ({
  id,
  action: 'user.custom-role.assign',
  entity_id: 'u-1',
  user_id: 'admin-9',
  actor_name: 'Admin Two',
  created_at: '2026-02-02T00:00:00.600Z',
  details: { from_custom_role_id: null, to_custom_role_id: 5, reason: REASON, ...details },
  ...rest,
})

const mockLogs = (roleLogs = [], tagLogs = []) => listAuditLogs.mockImplementation(({ action }) => Promise.resolve(
  action === 'user.role.change' ? roleLogs : tagLogs,
))

async function renderHistory() {
  render(<UserManagement />)
  fireEvent.click(await screen.findByRole('tab', { name: 'Roles' }))
  return screen.findByText(/role and access change history/i)
}

beforeEach(() => {
  vi.clearAllMocks()
  listUsers.mockResolvedValue({ data: [USER], total: 1, page: 1, pageSize: 25 })
  listRoles.mockResolvedValue(ROLES)
  mockLogs()
})

describe('UserManagement access history', () => {
  it('renders role + custom rows sharing a change_id as one row with both details', async () => {
    mockLogs(
      [roleLog({ details: { change_id: CHANGE_ID } })],
      [tagLog({ details: { change_id: CHANGE_ID } })],
    )
    await renderHistory()

    await screen.findByText(REASON)
    // One row, not one per audit record.
    expect(screen.getAllByText(REASON)).toHaveLength(1)
    const row = screen.getByText(REASON).closest('tr')
    expect(within(row).getByText('Employer')).toBeInTheDocument()
    expect(within(row).getByText('Job Seeker')).toBeInTheDocument()
    expect(within(row).getByText('HR Officer')).toBeInTheDocument()
    // Administrator comes from the role log when the pair has both.
    expect(within(row).getByText('Admin One')).toBeInTheDocument()
    expect(listAuditLogs).toHaveBeenCalledWith({ action: 'user.role.change', limit: 50 })
    expect(listAuditLogs).toHaveBeenCalledWith({ action: 'user.custom-role.assign', limit: 50 })
  })

  it('pairs a legacy role + custom row written within 10 seconds into one row', async () => {
    mockLogs(
      [roleLog()],
      [tagLog({ id: 22, created_at: '2026-02-02T00:00:06.000Z' })],
    )
    await renderHistory()

    await screen.findByText(REASON)
    expect(screen.getAllByText(REASON)).toHaveLength(1)
    const row = screen.getByText(REASON).closest('tr')
    expect(within(row).getByText('Job Seeker')).toBeInTheDocument()
    expect(within(row).getByText('HR Officer')).toBeInTheDocument()
  })

  it('does not pair legacy rows more than 10 seconds apart', async () => {
    mockLogs(
      [roleLog()],
      [tagLog({ id: 22, created_at: '2026-02-02T00:00:11.000Z' })],
    )
    await renderHistory()

    await screen.findAllByText(REASON)
    expect(screen.getAllByText(REASON)).toHaveLength(2)
  })

  it('reads the legacy custom_role_id key for the Access label', async () => {
    mockLogs([], [{
      ...tagLog(),
      details: { from_custom_role_id: null, custom_role_id: 5, reason: REASON },
    }])
    await renderHistory()

    const row = (await screen.findByText(REASON)).closest('tr')
    expect(within(row).getByText('HR Officer')).toBeInTheDocument()
    expect(within(row).queryByText('No custom role')).toBeNull()
  })

  it('renders a duplicated log id once', async () => {
    const duplicate = roleLog()
    mockLogs([duplicate, duplicate], [])
    await renderHistory()

    await screen.findByText(REASON)
    expect(screen.getAllByText(REASON)).toHaveLength(1)
  })

  it('renders target_name for a user outside the loaded page', async () => {
    mockLogs([roleLog({ entity_id: 'u-99', target_name: 'grace hopper' })], [])
    await renderHistory()

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
  })

  it('shows Not recorded for a legacy row without a reason', async () => {
    mockLogs([roleLog({ details: { reason: null } })], [])
    await renderHistory()

    const row = (await screen.findByText('Not recorded')).closest('tr')
    expect(within(row).getByText('Job Seeker')).toBeInTheDocument()
  })
})
