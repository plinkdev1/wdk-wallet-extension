import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from './dropdown-menu.js';

function ControlledMenu({ onSelect }: { onSelect?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onSelect}>Copy</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('renders trigger but not content when closed', () => {
    render(<ControlledMenu />);
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  });

  it('opens menu when trigger is clicked (via user-event for pointer-event simulation)', async () => {
    const user = userEvent.setup();
    render(<ControlledMenu />);
    await user.click(screen.getByText('Menu'));
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('renders label, items, and separator when open', async () => {
    const user = userEvent.setup();
    render(<ControlledMenu />);
    await user.click(screen.getByText('Menu'));
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('fires onSelect when item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ControlledMenu onSelect={onSelect} />);
    await user.click(screen.getByText('Menu'));
    await user.click(screen.getByText('Copy'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('applies theme styling to DropdownMenuContent (--bg-elevated-2)', async () => {
    const user = userEvent.setup();
    render(<ControlledMenu />);
    await user.click(screen.getByText('Menu'));
    const content = screen.getByRole('menu');
    expect(content.style.backgroundColor).toBe('var(--bg-elevated-2)');
  });

  it('applies theme styling to DropdownMenuItem (var(--radius-sm))', async () => {
    const user = userEvent.setup();
    render(<ControlledMenu />);
    await user.click(screen.getByText('Menu'));
    const items = screen.getAllByRole('menuitem');
    expect(items[0].style.borderRadius).toBe('var(--radius-sm)');
  });

  it('sets role=menu and role=menuitem via Radix', async () => {
    const user = userEvent.setup();
    render(<ControlledMenu />);
    await user.click(screen.getByText('Menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').length).toBe(2);
  });
});