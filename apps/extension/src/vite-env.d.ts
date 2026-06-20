/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ETH_RPC_URL?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
  // MoonPay fiat on-ramp (publishable key + optional backend URL signer).
  readonly VITE_MOONPAY_API_KEY?: string;
  readonly VITE_MOONPAY_ENV?: 'sandbox' | 'production';
  readonly VITE_MOONPAY_SIGN_URL?: string;
  // ERC-4337 smart accounts (bundler + optional paymaster).
  readonly VITE_BUNDLER_URL?: string;
  readonly VITE_PAYMASTER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}