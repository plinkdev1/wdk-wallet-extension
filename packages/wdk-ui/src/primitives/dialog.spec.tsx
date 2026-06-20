import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from './dialog.js';

/** Test harness for controlled Dialog. */
function ControlledDialog({ onOpenChange }: { onOpenChange?: (o: boolean) => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirm</DialogTitle>
        <DialogDescription>Are you sure?</DialogDescription>
        <DialogClose>Cancel</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders trigger but not content when closed (default)', () => {
    render(<ControlledDialog />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('opens content when trigger is clicked', async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => expect(screen.getByText('Confirm')).toBeInTheDocument());
  });

  it('fires onOpenChange(true) when trigger is clicked', async () => {
    const onOpenChange = vi.fn();
    render(<ControlledDialog onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
  });

  it('renders title, description, and close button when open', async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('applies theme styling to DialogContent (--bg-elevated-2 background)', async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => {
      const content = screen.getByRole('dialog');
      expect(content.style.backgroundColor).toBe('var(--bg-elevated-2)');
      expect(content.style.borderRadius).toBe('var(--radius-lg)');
    });
  });

  it('applies theme styling to DialogTitle (--font-display)', async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => {
      const title = screen.getByText('Confirm');
      expect(title.style.fontFamily).toBe('var(--font-display)');
    });
  });

  it('sets role=dialog on DialogContent via Radix', async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });
});