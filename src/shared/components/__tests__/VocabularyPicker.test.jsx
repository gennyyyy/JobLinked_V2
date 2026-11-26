import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/shared/services/reference', () => ({ getReferenceValues: vi.fn() }))

import { getReferenceValues } from '@/shared/services/reference'
import VocabularyPicker from '../VocabularyPicker'

function Multi({ initial = [], onChange, ...props }) {
  const [value, setValue] = useState(initial)
  return (
    <VocabularyPicker
      id="skills"
      label="Skills"
      category="skill-test"
      multiple
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
      {...props}
    />
  )
}

describe('VocabularyPicker', () => {
  beforeEach(() => {
    getReferenceValues.mockReset()
  })

  it('renders only the fetched values in a labelled group', async () => {
    getReferenceValues.mockResolvedValue(['Welding', 'Driving'])
    render(<Multi category="skill-render" />)

    expect(await screen.findByRole('checkbox', { name: 'Welding' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.queryByRole('checkbox', { name: 'Plumbing' })).toBeNull()
    expect(getReferenceValues).toHaveBeenCalledWith('skill-render')
  })

  it('adds and removes with mouse and keyboard, emitting canonical order', async () => {
    getReferenceValues.mockResolvedValue(['Welding', 'Driving'])
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Multi category="skill-toggle" onChange={onChange} />)

    const welding = await screen.findByRole('checkbox', { name: 'Welding' })
    const driving = screen.getByRole('checkbox', { name: 'Driving' })

    await user.click(driving)
    expect(driving).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(['Driving'])

    // Clicking left focus on Driving; shift+tab reaches Welding, Space toggles.
    await user.tab({ shift: true })
    expect(welding).toHaveFocus()
    await user.keyboard(' ')
    expect(welding).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(['Welding', 'Driving'])

    await user.click(welding)
    expect(welding).not.toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(['Driving'])
  })

  it('enforces max: unselected chips disable and the help states the limit', async () => {
    getReferenceValues.mockResolvedValue(['Welding', 'Driving', 'Cooking'])
    const user = userEvent.setup()
    render(<Multi category="skill-max" max={2} />)

    const welding = await screen.findByRole('checkbox', { name: 'Welding' })
    const driving = screen.getByRole('checkbox', { name: 'Driving' })
    const cooking = screen.getByRole('checkbox', { name: 'Cooking' })

    expect(screen.getByText(/select up to 2/i)).toBeInTheDocument()

    await user.click(welding)
    await user.click(driving)
    expect(cooking).toBeDisabled()
    expect(welding).toBeEnabled()

    await user.click(welding)
    expect(cooking).toBeEnabled()
  })

  it('single select returns one value and null for "Not set"', async () => {
    getReferenceValues.mockResolvedValue(['Construction', 'Information Technology'])
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <VocabularyPicker
        id="field"
        label="Field"
        category="job_field-single"
        multiple={false}
        value=""
        onChange={onChange}
      />,
    )

    const select = screen.getByLabelText('Field')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Construction' })).toBeInTheDocument())

    await user.selectOptions(select, 'Construction')
    expect(onChange).toHaveBeenLastCalledWith('Construction')

    await user.selectOptions(select, '')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('shows a disabled "Select a field" placeholder and no "Not set" when required', async () => {
    getReferenceValues.mockResolvedValue(['Construction'])
    render(
      <VocabularyPicker
        id="field-required"
        label="Field"
        category="job_field-required"
        multiple={false}
        required
        placeholder="Select a field"
        value=""
        onChange={() => {}}
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'Construction' })).toBeInTheDocument())
    const placeholder = screen.getByRole('option', { name: 'Select a field' })
    expect(placeholder).toBeDisabled()
    expect(placeholder).toHaveAttribute('value', '')
    expect(screen.queryByRole('option', { name: 'Not set' })).toBeNull()
    expect(screen.getByLabelText(/^field/i)).toBeRequired()
  })

  it('announces loading and disables the single control', () => {
    getReferenceValues.mockReturnValue(new Promise(() => {}))
    render(
      <VocabularyPicker
        id="field-loading"
        label="Field"
        category="job_field-loading"
        multiple={false}
        value=""
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(screen.getByLabelText('Field')).toBeDisabled()
  })

  it('shows a load error and retries the fetch', async () => {
    getReferenceValues
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(['Welding'])
    const user = userEvent.setup()
    render(<Multi category="skill-error" />)

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByRole('checkbox', { name: 'Welding' })).toBeInTheDocument()
    expect(getReferenceValues).toHaveBeenCalledTimes(2)
    expect(getReferenceValues).toHaveBeenLastCalledWith('skill-error')
  })

  it('renders the help text and no chips when the vocabulary is empty', async () => {
    getReferenceValues.mockResolvedValue([])
    render(<Multi category="skill-empty" help="No skills are listed yet." />)

    expect(await screen.findByText('No skills are listed yet.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('shares one request between pickers mounted together', async () => {
    getReferenceValues.mockResolvedValue(['Welding'])
    render(
      <>
        <Multi category="skill-shared" id="skills-a" label="Skills A" />
        <Multi category="skill-shared" id="skills-b" label="Skills B" />
      </>,
    )

    expect(await screen.findAllByRole('checkbox', { name: 'Welding' })).toHaveLength(2)
    expect(getReferenceValues).toHaveBeenCalledTimes(1)
  })
})
