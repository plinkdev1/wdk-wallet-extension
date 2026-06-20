import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs.js';

function TestTabs({ defaultValue = 'a' }: { defaultValue?: string } = {}) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b">Tab B</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel A</TabsContent>
      <TabsContent value="b">Panel B</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders both triggers', () => {
    render(<TestTabs />);
    expect(screen.getByText('Tab A')).toBeInTheDocument();
    expect(screen.getByText('Tab B')).toBeInTheDocument();
  });

  it('renders the default active panel and not the other', () => {
    render(<TestTabs defaultValue="a" />);
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
  });

  it('switches active panel when a different trigger is clicked (via user-event for mousedown)', async () => {
    const user = userEvent.setup();
    render(<TestTabs defaultValue="a" />);
    await user.click(screen.getByText('Tab B'));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
    expect(screen.queryByText('Panel A')).not.toBeInTheDocument();
  });

  it('applies theme styling to TabsList (--bg-elevated-1)', () => {
    render(<TestTabs />);
    const list = screen.getByRole('tablist');
    expect(list.style.backgroundColor).toBe('var(--bg-elevated-1)');
    expect(list.style.borderRadius).toBe('var(--radius-md)');
  });

  it('applies theme styling to TabsTrigger (--text-secondary inactive color)', () => {
    render(<TestTabs />);
    const triggers = screen.getAllByRole('tab');
    expect(triggers[0].style.color).toBe('var(--text-secondary)');
    expect(triggers[0].style.borderRadius).toBe('var(--radius-sm)');
  });

  it('sets data-state="active" on active trigger via Radix', () => {
    render(<TestTabs defaultValue="a" />);
    const triggers = screen.getAllByRole('tab');
    expect(triggers[0]).toHaveAttribute('data-state', 'active');
    expect(triggers[1]).toHaveAttribute('data-state', 'inactive');
  });

  it('sets role=tablist + role=tab + role=tabpanel via Radix', () => {
    render(<TestTabs />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(2);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('applies theme styling to TabsContent (--text-primary)', () => {
    render(<TestTabs />);
    const panel = screen.getByRole('tabpanel');
    expect(panel.style.color).toBe('var(--text-primary)');
  });
});