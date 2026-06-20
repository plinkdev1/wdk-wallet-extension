/**
 * @wdk-starter/wdk-ui - Tabs primitive (Radix UI based)
 *
 * Theme-styled wrapper around @radix-ui/react-tabs. Provides Root + List +
 * Trigger + Content as theme-aware components.
 *
 * Why Radix: tabs need proper roving-tabindex keyboard navigation
 * (arrow keys between tabs), ARIA role=tablist + role=tab + role=tabpanel
 * with aria-selected + aria-controls wiring, and automatic vs manual
 * activation modes. Radix handles all of these.
 *
 * Variables: --bg-elevated-1, --text-primary, --text-secondary,
 * --color-primary, --border-default, --radius-md, --radius-sm,
 * --motion-duration, --font-body.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ElementRef } from 'react';

/** Tabs root - manages active tab state. */
export const Tabs = TabsPrimitive.Root;

const listStyle: CSSProperties = {
  display:         'inline-flex',
  alignItems:      'center',
  gap:             '4px',
  padding:         '4px',
  backgroundColor: 'var(--bg-elevated-1)',
  borderRadius:    'var(--radius-md)',
};

/**
 * Tabs list - container for triggers.
 *
 * @example
 *   <Tabs defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="settings">Settings</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">...</TabsContent>
 *     <TabsContent value="settings">...</TabsContent>
 *   </Tabs>
 */
export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ style, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} style={{ ...listStyle, ...style }} {...props} />
));
TabsList.displayName = 'TabsList';

const triggerStyle: CSSProperties = {
  display:         'inline-flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         '6px 14px',
  fontSize:        '14px',
  fontWeight:      500,
  fontFamily:      'var(--font-body)',
  color:           'var(--text-secondary)',
  backgroundColor: 'transparent',
  borderRadius:    'var(--radius-sm)',
  borderStyle:     'none',
  cursor:          'pointer',
  outline:         'none',
  transitionProperty: 'color, background-color',
  transitionDuration: 'var(--motion-duration)',
};

/**
 * Tabs trigger. Active state styling driven by Radix's data-state="active"
 * attribute - consumers can target it via CSS: [data-state="active"] { ... }.
 * v0.x: inline style covers inactive state only; active styling requires a
 * data-state selector or runtime override.
 */
export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ style, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} style={{ ...triggerStyle, ...style }} {...props} />
));
TabsTrigger.displayName = 'TabsTrigger';

const contentStyle: CSSProperties = {
  marginTop:  '16px',
  outline:    'none',
  color:      'var(--text-primary)',
  fontFamily: 'var(--font-body)',
};

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ style, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} style={{ ...contentStyle, ...style }} {...props} />
));
TabsContent.displayName = 'TabsContent';