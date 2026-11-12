import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { CountdownTimer } from '../components/CountdownTimer';
import { Modal } from '../components/Modal';
import { Forbidden403 } from '../pages/Forbidden403';
import { NotFound404 } from '../pages/NotFound404';

describe('Frontend UI Components & Edge Cases', () => {
  it('StatusBadge: renders correct label and style for distinct statuses', () => {
    const { rerender } = render(<StatusBadge status="CONFIRMED" />);
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();

    rerender(<StatusBadge status="PENDING_PAYMENT" />);
    expect(screen.getByText('PENDING PAYMENT')).toBeInTheDocument();

    rerender(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
  });

  it('CountdownTimer: decrements and invokes onExpire callback on timeout', () => {
    vi.useFakeTimers();
    const handleExpire = vi.fn();

    render(<CountdownTimer initialSeconds={3} onExpire={handleExpire} />);
    expect(screen.getByText(/Hold expires in: 00:03/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(handleExpire).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('Modal: renders contents when open and hides when closed', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Modal Body Content</div>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();

    rerender(
      <Modal isOpen={false} onClose={handleClose} title="Test Modal">
        <div>Modal Body Content</div>
      </Modal>
    );

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('Forbidden403: renders 403 error page with back button', () => {
    render(
      <BrowserRouter>
        <Forbidden403 />
      </BrowserRouter>
    );

    expect(screen.getByText(/403 - Access Forbidden/i)).toBeInTheDocument();
  });

  it('NotFound404: renders 404 page', () => {
    render(
      <BrowserRouter>
        <NotFound404 />
      </BrowserRouter>
    );

    expect(screen.getByText(/404 - Page Not Found/i)).toBeInTheDocument();
  });
});
