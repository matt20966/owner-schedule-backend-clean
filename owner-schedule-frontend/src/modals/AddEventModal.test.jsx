// AddEventModal.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddEventModal from './AddEventModal';
import { DateTime } from 'luxon';

describe('AddEventModal', () => {
  const mockOnClose = jest.fn();
  const mockOnAddEvent = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onAddEvent: mockOnAddEvent,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when isOpen is true', () => {
    render(<AddEventModal {...defaultProps} />);

    expect(screen.getByText(/Add New Event/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
  });

  test('does not render modal when isOpen is false', () => {
    render(<AddEventModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText(/Add New Event/i)).not.toBeInTheDocument();
  });

  test('shows validation errors for required fields', () => {
    render(<AddEventModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Add Event/i));

    expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Start time is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Please fix the validation errors/i)
    ).toBeInTheDocument();
  });

  test('calls onClose when Cancel button is clicked', () => {
    render(<AddEventModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/Cancel/i));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onAddEvent with correct data when form is valid', () => {
    render(<AddEventModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'Team Meeting' },
    });
    fireEvent.change(screen.getByLabelText(/Date/i), {
      target: { value: '2025-09-10' },
    });
    fireEvent.change(screen.getByLabelText(/Start Time/i), {
      target: { value: '09:30' },
    });

    fireEvent.click(screen.getByText(/Add Event/i));

    const expectedDateTime = DateTime.fromISO('2025-09-10T09:30').toISO({
      includeOffset: true,
    });

    expect(mockOnAddEvent).toHaveBeenCalledTimes(1);
    expect(mockOnAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Team Meeting',
        datetime: expectedDateTime,
        duration: 60,
      })
    );
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('shows error for invalid date (non-leap year Feb 29)', async () => {
    render(<AddEventModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'Leap Test' },
    });
    fireEvent.change(screen.getByLabelText(/Date/i), {
      target: { value: '2025-02-29' },
    });
    fireEvent.change(screen.getByLabelText(/Start Time/i), {
      target: { value: '10:00' },
    });

    fireEvent.click(screen.getByText(/Add Event/i));

    // Wait for validation error to appear
    expect(
      await screen.findByText(/February 29th in 2025/i)
    ).toBeInTheDocument();

    expect(mockOnAddEvent).not.toHaveBeenCalled();
  });
});
