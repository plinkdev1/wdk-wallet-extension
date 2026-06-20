/**
 * Local TypeScript declaration for the 'process' npm polyfill.
 *
 * The 'process' package on npm (v0.11.10, a CommonJS-only polyfill of Node's
 * built-in 'process' module) does not ship its own types. We do not pull in
 * @types/node because that would expose Node-specific globals (Buffer,
 * process, etc.) that we want to manage explicitly through polyfill-globals.ts
 * rather than have leak across the wdk-web-core type surface. @types/process
 * exists on DefinitelyTyped but is essentially unmaintained.
 *
 * The surface we actually rely on is tiny: we import the process polyfill
 * solely to assign it to globalThis from polyfill-globals.ts; we never read
 * process.env, process.nextTick, etc. from wdk-web-core code. This shim
 * declares the minimum that makes typecheck happy.
 */
declare module 'process' {
  /**
   * The `process` polyfill exports the process object as a CommonJS default
   * export. Consumer code (polyfill-globals.ts) assigns it to globalThis.
   */
  const process: {
    readonly env: Record<string, string | undefined>;
    readonly nextTick: (
      callback: () => void,
      ...args: readonly unknown[]
    ) => void;
    readonly [key: string]: unknown;
  };
  export default process;
}