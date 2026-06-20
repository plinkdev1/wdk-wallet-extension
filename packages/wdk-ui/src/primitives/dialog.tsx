/**
 * @wdk-starter/wdk-ui - Dialog primitive (Radix UI based)
 *
 * Theme-styled wrapper around @radix-ui/react-dialog. Re-exports the
 * compositional parts (Root, Trigger, Portal, Overlay, Content, Title,
 * Description, Close) as theme-aware components. Matches shadcn-style API
 * shape for familiarity.
 *
 * Why Radix: dialogs need real focus traps, focus restoration on close,
 * ARIA role=dialog + aria-modal + aria-labelledby/describedby wiring,
 * Escape key handling, and scroll lock. Hand-rolling this correctly is
 * error-prone. Radix UI is the de-facto standard for headless React
 * primitives and is battle-tested across thousands of production apps.
 *
 * Variables: --bg-elevated-2, --text-primary, --text-secondary,
 * --border-default, --radius-lg, --glass-blur, --font-display, --font-body.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ElementRef } from 'react';

/** Dialog root - provides open/onOpenChange context. */
export const Dialog = DialogPrimitive.Root;
/** Dialog trigger button - clicking opens the dialog. */
export const DialogTrigger = DialogPrimitive.Trigger;
/** Dialog close button - clicking closes the dialog. */
export const DialogClose = DialogPrimitive.Close;
/** Manual portal escape hatch - DialogContent already portals automatically. */
export const DialogPortal = DialogPrimitive.Portal;

const overlayStyle: CSSProperties = {
  position:        'fixed',
  inset:           0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter:  'blur(var(--glass-blur))',
  zIndex:          50,
};

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ style, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} style={{ ...overlayStyle, ...style }} {...props} />
));
DialogOverlay.displayName = 'DialogOverlay';

const contentStyle: CSSProperties = {
  position:        'fixed',
  top:             '50%',
  left:            '50%',
  transform:       'translate(-50%, -50%)',
  backgroundColor: 'var(--bg-elevated-2)',
  color:           'var(--text-primary)',
  borderRadius:    'var(--radius-lg)',
  borderWidth:     '1px',
  borderStyle:     'solid',
  borderColor:     'var(--border-default)',
  padding:         '24px',
  minWidth:        '320px',
  maxWidth:        '480px',
  boxShadow:       '0 10px 25px rgba(0, 0, 0, 0.3)',
  zIndex:          50,
};

/**
 * Dialog content. Automatically wraps in DialogPortal + DialogOverlay.
 *
 * @example
 *   <Dialog>
 *     <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
 *     <DialogContent>
 *       <DialogTitle>Confirm action</DialogTitle>
 *       <DialogDescription>Are you sure?</DialogDescription>
 *       <DialogClose asChild><Button>Cancel</Button></DialogClose>
 *     </DialogContent>
 *   </Dialog>
 */
export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ style, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} style={{ ...contentStyle, ...style }} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

const titleStyle: CSSProperties = {
  fontFamily:    'var(--font-display)',
  fontWeight:    600,
  fontSize:      '18px',
  lineHeight:    1.3,
  marginBottom:  '8px',
  color:         'var(--text-primary)',
};

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ style, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} style={{ ...titleStyle, ...style }} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

const descriptionStyle: CSSProperties = {
  fontFamily:    'var(--font-body)',
  fontSize:      '14px',
  lineHeight:    1.5,
  color:         'var(--text-secondary)',
  marginBottom:  '16px',
};

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ style, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} style={{ ...descriptionStyle, ...style }} {...props} />
));
DialogDescription.displayName = 'DialogDescription';