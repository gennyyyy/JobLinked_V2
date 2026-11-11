import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import JobPostFormDialog from '../JobPostFormDialog'
import { getFeeTerms } from '../../../shared/services/feeFilter'

vi.mock('../../../shared/services/feeFilter', () => ({
  getFeeTerms: vi.fn(),
}))

function Host({ initial = {} }) {
  const [form, setForm] = useState({
    title: '',
    office: '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    location: '',
    vacancies: 1,
    deadline: '',
    instructions: '',
    benefits: [],
    tags: [],
    ...initial,
  })
  const [errors, setErrors] = useState({})
  return (
    <JobPostFormDialog
      form={form}
      setForm={setForm}
      setErrors={setErrors}
      errors={errors}
      saving={false}
      editingId={null}
      confirmDiscard={false}
      onRequestClose={() => {}}
      onSave={() => {}}
    />
  )
}

describe('JobPostFormDialog fee filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches fee terms on mount and warns when description contains a block term', async () => {
    getFeeTerms.mockResolvedValue({ block: ['registration fee'], hold: ['fee'] })
    render(<Host initial={{ description: 'We charge a registration fee of 500.' }} />)

    await waitFor(() => expect(getFeeTerms).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/PESO review:/i)).toHaveTextContent('registration fee')
  })

  it('highlights a matched phrase as the employer types', async () => {
    getFeeTerms.mockResolvedValue({ block: ['registration fee'], hold: ['fee'] })
    render(<Host />)

    await waitFor(() => expect(getFeeTerms).toHaveBeenCalledTimes(1))

    const desc = screen.getByPlaceholderText(/Outline key duties/i)
    fireEvent.change(desc, { target: { value: 'Pay a registration fee now.' } })

    await waitFor(() =>
      expect(screen.getByText(/PESO review:/i)).toHaveTextContent('registration fee')
    )
  })

  it('renders no warning for clean text', async () => {
    getFeeTerms.mockResolvedValue({ block: ['registration fee'], hold: ['fee'] })
    render(<Host initial={{ description: 'No fees required.' }} />)

    await waitFor(() => expect(getFeeTerms).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/PESO review:/i)).not.toBeInTheDocument()
  })
})
