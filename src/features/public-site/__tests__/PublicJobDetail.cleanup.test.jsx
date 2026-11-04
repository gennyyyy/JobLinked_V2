import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import PublicJobDetail from '../PublicJobDetail';

vi.mock('../../../shared/services/jobs', () => ({
  getJob: vi.fn(),
}));

import { getJob } from '../../../shared/services/jobs';

// Simulates navigating away before the job loads.
function NavigateAway({ delay = 50 }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => navigate('/other'), delay);
    return () => clearTimeout(timer);
  }, [navigate, delay]);
  return null;
}

describe('PublicJobDetail cleanup', () => {
  it('does not update state after navigation away', async () => {
    let resolveJob;
    getJob.mockImplementation(() => new Promise((resolve) => { resolveJob = resolve; }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/jobs/123']}>
        <NavigateAway delay={10} />
        <Routes>
          <Route path="/jobs/:jobId" element={<PublicJobDetail />} />
          <Route path="/other" element={<div>Other Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for navigation to happen.
    await waitFor(() => expect(screen.getByText('Other Page')).toBeInTheDocument());

    // Now resolve the job — the component is already unmounted.
    // This should not cause a state update error.
    resolveJob({ id: '123', title: 'Test Job' });

    // Give React a chance to process any pending updates.
    await waitFor(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // No React state update errors should have been logged.
    const stateUpdateErrors = consoleSpy.mock.calls.filter((call) =>
      call[0]?.includes?.('Cannot update a component') ||
      call[0]?.includes?.('unmounted component')
    );
    expect(stateUpdateErrors).toHaveLength(0);

    consoleSpy.mockRestore();
  });
});
