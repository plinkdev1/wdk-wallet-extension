/**
 * @wdk-starter/wdk-ui - DropdownMenu primitive (Radix UI based)
 *
 * Theme-styled wrapper around @radix-ui/react-dropdown-menu. Provides
 * Root + Trigger + Portal + Content + Item + Separator + Label as
 * theme-aware components.
 *
 * Why Radix: dropdown menus need keyboard navigation (arrow keys, Home/End,
 * type-ahead), focus management, ARIA role=menu + role=menuitem wiring,
 * collision-aware positioning, and click-outside-to-close. Radix handles
 * all of these correctly.
 *
 * Variables: --bg-elevated-2, --bg-elevated-3, --text-primary,
 * --text-secondary, --border-default, --radius-md, --radius-sm,
 * --motion-duration, --font-body.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ElementRef } from 'react';

/** DropdownMenu root - manages open state. */
export const DropdownMenu = DropdownPrimitive.Root;
/** DropdownMenu trigger - clicking opens the menu. */
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
/** Manual portal escape hatch - DropdownMenuContent already portals automatically. */
export const DropdownMenuPortal = DropdownPrimitive.Portal;
/** DropdownMenu group - groups items semantically. */
export const DropdownMenuGroup = DropdownPrimitive.Group;

const contentStyle: CSSProperties = {
  backgroundColor: 'var(--bg-elevated-2)',
  color:           'var(--text-primary)',
  borderRadius:    'var(--radius-md)',
  borderWidth:     '1px',
  borderStyle:     'solid',
  borderColor:     'var(--border-default)',
  padding:         '4px',
  minWidth:        '180px',
  boxShadow:       '0 4px 12px rgba(0, 0, 0, 0.15)',
  zIndex:          50,
  fontFamily:      'var(--font-body)',
};

/**
 * DropdownMenu content. Automatically wraps in DropdownMenuPortal.
 *
 * @example
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem onSelect={...}>Copy</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem onSelect={...}>Delete</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ style, sideOffset = 4, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{ ...contentStyle, ...style }}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

const itemStyle: CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  padding:        '8px 12px',
  borderRadius:   'var(--radius-sm)',
  fontSize:       '14px',
  cursor:         'pointer',
  outline:        'none',
  userSelect:     'none',
  transitionProperty: 'background-color',
  transitionDuration: 'var(--motion-duration)',
};

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ style, ...props }, ref) => (
  <DropdownPrimitive.Item ref={ref} style={{ ...itemStyle, ...style }} {...props} />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

const separatorStyle: CSSProperties = {
  height:          '1px',
  margin:          '4px 0',
  backgroundColor: 'var(--border-default)',
};

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(({ style, ...props }, ref) => (
  <DropdownPrimitive.Separator ref={ref} style={{ ...separatorStyle, ...style }} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const labelStyle: CSSProperties = {
  padding:    '6px 12px',
  fontSize:   '12px',
  fontWeight: 600,
  color:      'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(({ style, ...props }, ref) => (
  <DropdownPrimitive.Label ref={ref} style={{ ...labelStyle, ...style }} {...props} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';