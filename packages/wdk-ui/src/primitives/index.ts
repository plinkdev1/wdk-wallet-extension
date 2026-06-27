/**
 * @wdk-starter/wdk-ui/primitives - base UI primitives barrel.
 *
 * v0.4 (w-4a): Button, Card.
 * v0.5 (w-4b): + Input, Label, Separator, Badge, Skeleton.
 * v0.6 (w-4c): + Dialog, DropdownMenu, Tabs (Radix UI wrappers).
 */

// w-4a primitives
export { Button } from './button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button.js';

export { Card } from './card.js';
export type { CardProps, CardVariant, CardPadding } from './card.js';

// w-4b primitives
export { Input } from './input.js';
export type { InputProps, InputVariant, InputSize } from './input.js';

export { Label } from './label.js';
export type { LabelProps } from './label.js';

export { Separator } from './separator.js';
export type { SeparatorProps, SeparatorOrientation } from './separator.js';

export { Badge } from './badge.js';
export type { BadgeProps, BadgeVariant } from './badge.js';

export { Skeleton } from './skeleton.js';
export type { SkeletonProps } from './skeleton.js';

// w-4c primitives (Radix-based)
export {
  Dialog, DialogTrigger, DialogClose, DialogPortal,
  DialogOverlay, DialogContent, DialogTitle, DialogDescription,
} from './dialog.js';

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuGroup,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from './dropdown-menu.js';

export {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from './tabs.js';
export * from './network-icon.js';
export * from './token-icon.js';
export * from './token-chip.js';
export * from './tab-bar.js';

// Send-flow primitives (PRD §3.1)
export * from './amount-input.js';
export * from './review-sheet.js';
export * from './success-screen.js';
export * from './status-pill.js';
