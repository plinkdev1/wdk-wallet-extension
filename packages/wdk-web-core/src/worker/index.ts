export { WalletWorker, type WalletWorkerOptions } from './wallet-worker.js';
export {
  installMv3MessageHandler,
  handleMv3Request,
  isValidMv3Request,
  type ChromeMessageListener,
  type ChromeRuntimeMessageHook,
} from './mv3-handler.js';