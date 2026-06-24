/**
 * SparkView — the full Spark (Bitcoin L2) surface for the extension popup.
 *
 * Spark is its own chain (Lightspark statechains + FROST signing) keyed off the
 * same mnemonic, independent of the active EVM/BTC/etc chain selection. Lightning
 * is a payment rail Spark settles natively, so it lives here as a tab rather than
 * as a separate chain.
 *
 * Two top-level tabs:
 *   • Spark    — native L2: Receive (your spark1… address), Send (Spark→Spark),
 *                Deposit (fund from Bitcoin L1), Withdraw (cooperative exit to BTC).
 *   • Lightning — BOLT11: Receive (create an invoice) and Pay (settle one).
 *
 * The SW lazy-loads the Spark SDK on first call. On the MV3 service worker, where
 * dynamic import() is restricted (F-MV3-04), the worker throws a descriptive error
 * which surfaces here as the connect-error state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Label } from '@wdk-starter/wdk-ui';
import { decodeBolt11, isSparkAddress, isBitcoinAddress } from '@wdk-starter/wdk-web-core/payments';
import type { SparkExitSpeed } from '../../types/messages.js';
import { send } from '../lib/sw-client.js';
import { qrDataUrl } from '../lib/qr.js';

const SPARK_PURPLE = '#7916FF';

/** Resolves a packaged asset URL (chrome-extension://… at runtime; bare path in tests). */
function assetUrl(path: string): string {
  try {
    const c = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome;
    if (c?.runtime?.getURL) return c.runtime.getURL(path);
  } catch {
    /* jsdom / non-extension context */
  }
  return path;
}

const SPARK_ICON = assetUrl('icons/spark.svg');
const LIGHTNING_ICON = assetUrl('icons/lightning.png');

export interface SparkViewProps {
  readonly accountIndex: number;
  readonly onBack: () => void;
}

type TopTab = 'spark' | 'lightning';

export function SparkView({ accountIndex, onBack }: SparkViewProps): JSX.Element {
  const [top, setTop] = useState<TopTab>('spark');
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [statusMsg, setStatusMsg] = useState('');

  const refreshBalance = useCallback(async (): Promise<void> => {
    try {
      setBalance(await send({ type: 'SPARK_GET_BALANCE', accountIndex }));
    } catch {
      /* balance optional */
    }
  }, [accountIndex]);

  useEffect(() => {
    let off = false;
    void (async () => {
      setStatus('connecting');
      try {
        const addr = await send({ type: 'SPARK_GET_ADDRESS', accountIndex });
        if (off) return;
        setAddress(addr);
        setStatus('ready');
        void refreshBalance();
      } catch (err) {
        if (off) return;
        setStatus('error');
        setStatusMsg(err instanceof Error ? err.message : 'Could not connect to Spark.');
      }
    })();
    return () => { off = true; };
  }, [accountIndex, refreshBalance]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>
        <img src={SPARK_ICON} alt="" width={24} height={24} style={{ borderRadius: 6 }} />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Spark</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #b3a79f)' }}>Bitcoin L2 · Lightning-native</div>
        </div>
      </header>

      {status === 'connecting' && <p style={note}>Connecting to Spark… (first use loads the Spark module).</p>}
      {status === 'error' && <div role="alert" style={errBox}>{statusMsg}</div>}

      {status === 'ready' && (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
              <Label>Spark balance</Label>
              <strong style={{ fontSize: 15 }}>{balance !== null ? `${balance} sats` : '…'}</strong>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 6 }}>
            <TopTabButton active={top === 'spark'} onClick={() => setTop('spark')} icon={SPARK_ICON} label="Spark" />
            <TopTabButton active={top === 'lightning'} onClick={() => setTop('lightning')} icon={LIGHTNING_ICON} label="Lightning" />
          </div>

          {top === 'spark'
            ? <SparkPane accountIndex={accountIndex} address={address} onChanged={refreshBalance} />
            : <LightningPane accountIndex={accountIndex} />}
        </>
      )}
    </div>
  );
}

function TopTabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '9px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
        border: active ? `1px solid ${SPARK_PURPLE}` : '1px solid var(--border-subtle, var(--border))',
        background: active ? 'rgba(121,22,255,0.12)' : 'var(--bg-elevated-2)',
        color: 'var(--text-primary)',
      }}
    >
      <img src={icon} alt="" width={18} height={18} />
      {label}
    </button>
  );
}

// ───────────────────────────── Spark (native L2) ────────────────────────────

type SparkAction = 'receive' | 'send' | 'deposit' | 'withdraw';

function SparkPane({ accountIndex, address, onChanged }: { accountIndex: number; address: string | null; onChanged: () => void }): JSX.Element {
  const [action, setAction] = useState<SparkAction>('receive');
  return (
    <div style={col}>
      <Segmented
        options={[['receive', 'Receive'], ['send', 'Send'], ['deposit', 'Deposit'], ['withdraw', 'Withdraw']]}
        value={action}
        onChange={(v) => setAction(v as SparkAction)}
      />
      {action === 'receive' && <SparkReceive address={address} />}
      {action === 'send' && <SparkSend accountIndex={accountIndex} onChanged={onChanged} />}
      {action === 'deposit' && <SparkDeposit accountIndex={accountIndex} />}
      {action === 'withdraw' && <SparkWithdraw accountIndex={accountIndex} onChanged={onChanged} />}
    </div>
  );
}

function SparkReceive({ address }: { address: string | null }): JSX.Element {
  const qr = useMemo(() => (address ? qrDataUrl(address) : ''), [address]);
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }, [address]);
  if (!address) return <p style={note}>Deriving your Spark address…</p>;
  return (
    <div style={{ ...col, alignItems: 'center' }}>
      <p style={note}>Your Spark address — receive sats from any Spark wallet.</p>
      {qr && <img src={qr} alt="Spark address QR" width={180} height={180} style={{ borderRadius: 10 }} />}
      <code style={addrCode}>{address}</code>
      <Button onClick={() => { void copy(); }} style={{ width: '100%' }}>{copied ? 'Copied ✓' : 'Copy Spark address'}</Button>
    </div>
  );
}

function SparkSend({ accountIndex, onChanged }: { accountIndex: number; onChanged: () => void }): JSX.Element {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const toValid = to.trim() === '' || isSparkAddress(to.trim());

  async function submit(): Promise<void> {
    setError(null);
    const dest = to.trim();
    if (!isSparkAddress(dest)) { setError('Enter a valid Spark address (spark1…).'); return; }
    const sats = Number(amount);
    if (!Number.isInteger(sats) || sats <= 0) { setError('Enter an amount in whole sats.'); return; }
    setBusy(true);
    try {
      const hash = await send({ type: 'SPARK_SEND', accountIndex, to: dest, value: BigInt(sats).toString() });
      setDone(hash); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Send failed.'); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={col}>
        <p style={okText}>✅ Sent.</p>
        <code style={addrCode}>{done}</code>
        <Button variant="secondary" onClick={() => { setDone(null); setTo(''); setAmount(''); }} style={{ width: '100%' }}>Send again</Button>
      </div>
    );
  }
  return (
    <div style={col}>
      <p style={note}>Send sats instantly to another Spark address.</p>
      <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient Spark address (spark1…)" />
      {!toValid && <p style={err}>Not a valid Spark address.</p>}
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (sats)" inputMode="numeric" />
      {error && <div role="alert" style={errBox}>{error}</div>}
      <Button onClick={() => { void submit(); }} disabled={busy} style={{ width: '100%' }}>{busy ? 'Sending…' : 'Send sats'}</Button>
    </div>
  );
}

function SparkDeposit({ accountIndex }: { accountIndex: number }): JSX.Element {
  const [addr, setAddr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qr = useMemo(() => (addr ? qrDataUrl(addr) : ''), [addr]);

  async function load(): Promise<void> {
    setError(null); setBusy(true);
    try {
      setAddr(await send({ type: 'SPARK_GET_DEPOSIT_ADDRESS', accountIndex }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not get a deposit address.'); } finally { setBusy(false); }
  }
  async function copy(): Promise<void> {
    if (!addr) return;
    await navigator.clipboard.writeText(addr);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  if (!addr) {
    return (
      <div style={col}>
        <p style={note}>Fund your Spark balance from Bitcoin L1. Generate a reusable deposit address, then send BTC to it — it credits your Spark balance after the on-chain deposit confirms.</p>
        {error && <div role="alert" style={errBox}>{error}</div>}
        <Button onClick={() => { void load(); }} disabled={busy} style={{ width: '100%' }}>{busy ? 'Getting address…' : 'Get Bitcoin deposit address'}</Button>
      </div>
    );
  }
  return (
    <div style={{ ...col, alignItems: 'center' }}>
      <p style={note}>Send BTC (Bitcoin L1) to this address to top up Spark. Reusable.</p>
      {qr && <img src={qr} alt="Bitcoin deposit QR" width={180} height={180} style={{ borderRadius: 10 }} />}
      <code style={addrCode}>{addr}</code>
      <Button onClick={() => { void copy(); }} style={{ width: '100%' }}>{copied ? 'Copied ✓' : 'Copy deposit address'}</Button>
    </div>
  );
}

const EXIT_SPEEDS: Array<[SparkExitSpeed, string]> = [['FAST', 'Fast'], ['MEDIUM', 'Medium'], ['SLOW', 'Slow']];

function SparkWithdraw({ accountIndex, onChanged }: { accountIndex: number; onChanged: () => void }): JSX.Element {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [speed, setSpeed] = useState<SparkExitSpeed>('MEDIUM');
  const [quote, setQuote] = useState<{ totalFeeSats: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; status: string | null } | null>(null);
  const toValid = to.trim() === '' || isBitcoinAddress(to.trim());

  async function getQuote(): Promise<void> {
    setError(null); setQuote(null);
    const dest = to.trim();
    if (!isBitcoinAddress(dest)) { setError('Enter a valid Bitcoin address.'); return; }
    const sats = Number(amount);
    if (!Number.isInteger(sats) || sats <= 0) { setError('Enter an amount in whole sats.'); return; }
    setBusy(true);
    try {
      const q = await send({ type: 'SPARK_QUOTE_WITHDRAW', accountIndex, to: dest, amountSats: sats, exitSpeed: speed });
      setQuote({ totalFeeSats: q.totalFeeSats });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not get a fee quote.'); } finally { setBusy(false); }
  }
  async function withdraw(): Promise<void> {
    setError(null); setBusy(true);
    try {
      const r = await send({ type: 'SPARK_WITHDRAW', accountIndex, to: to.trim(), amountSats: Number(amount), exitSpeed: speed });
      setDone({ id: r.id, status: r.status }); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Withdrawal failed.'); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={col}>
        <p style={okText}>✅ Withdrawal submitted.</p>
        <p style={note}>Cooperative exit to Bitcoin L1{done.status ? ` · ${done.status}` : ''}. Funds settle once the exit transaction confirms.</p>
        <code style={addrCode}>{done.id}</code>
        <Button variant="secondary" onClick={() => { setDone(null); setQuote(null); setTo(''); setAmount(''); }} style={{ width: '100%' }}>Withdraw again</Button>
      </div>
    );
  }
  return (
    <div style={col}>
      <p style={note}>Withdraw sats from Spark to a Bitcoin L1 address (cooperative exit).</p>
      <Input value={to} onChange={(e) => { setTo(e.target.value); setQuote(null); }} placeholder="Bitcoin address (bc1… / 1… / 3…)" />
      {!toValid && <p style={err}>Not a valid Bitcoin address.</p>}
      <Input value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null); }} placeholder="Amount (sats)" inputMode="numeric" />
      <Segmented options={EXIT_SPEEDS} value={speed} onChange={(v) => { setSpeed(v as SparkExitSpeed); setQuote(null); }} />
      {quote && (
        <div style={feePill}>
          <span style={{ opacity: 0.7 }}>Network fee</span>
          <strong>{quote.totalFeeSats} sats</strong>
        </div>
      )}
      {error && <div role="alert" style={errBox}>{error}</div>}
      {quote
        ? <Button onClick={() => { void withdraw(); }} disabled={busy} style={{ width: '100%' }}>{busy ? 'Withdrawing…' : `Confirm withdraw · fee ${quote.totalFeeSats} sats`}</Button>
        : <Button variant="secondary" onClick={() => { void getQuote(); }} disabled={busy} style={{ width: '100%' }}>{busy ? 'Quoting…' : 'Get fee quote'}</Button>}
    </div>
  );
}

// ───────────────────────────── Lightning (BOLT11) ───────────────────────────

type LnAction = 'receive' | 'pay';

function LightningPane({ accountIndex }: { accountIndex: number }): JSX.Element {
  const [action, setAction] = useState<LnAction>('receive');
  return (
    <div style={col}>
      <Segmented options={[['receive', 'Receive'], ['pay', 'Pay']]} value={action} onChange={(v) => setAction(v as LnAction)} />
      {action === 'receive' ? <LightningReceive accountIndex={accountIndex} /> : <LightningPay accountIndex={accountIndex} />}
    </div>
  );
}

function LightningReceive({ accountIndex }: { accountIndex: number }): JSX.Element {
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [invoice, setInvoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qr = useMemo(() => (invoice ? qrDataUrl(invoice.toUpperCase()) : ''), [invoice]);

  async function create(): Promise<void> {
    setError(null);
    const sats = Number(amount);
    if (!Number.isInteger(sats) || sats <= 0) { setError('Enter an amount in whole sats.'); return; }
    setBusy(true);
    try {
      setInvoice(await send({ type: 'LIGHTNING_CREATE_INVOICE', accountIndex, amountSats: sats, ...(memo ? { memo } : {}) }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create invoice.'); } finally { setBusy(false); }
  }
  async function copy(): Promise<void> {
    if (!invoice) return;
    await navigator.clipboard.writeText(invoice);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  if (invoice) {
    return (
      <div style={{ ...col, alignItems: 'center' }}>
        {qr && <img src={qr} alt="Lightning invoice QR" width={180} height={180} style={{ borderRadius: 10 }} />}
        <code style={addrCode}>{invoice}</code>
        <Button onClick={() => { void copy(); }} style={{ width: '100%' }}>{copied ? 'Copied ✓' : 'Copy invoice'}</Button>
        <Button variant="secondary" onClick={() => setInvoice(null)} style={{ width: '100%' }}>New invoice</Button>
      </div>
    );
  }
  return (
    <div style={col}>
      <p style={note}>Create a BOLT11 invoice — payable from any Lightning wallet.</p>
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (sats)" inputMode="numeric" />
      <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo (optional)" />
      {error && <div role="alert" style={errBox}>{error}</div>}
      <Button onClick={() => { void create(); }} disabled={busy} style={{ width: '100%' }}>{busy ? 'Creating…' : 'Create invoice'}</Button>
    </div>
  );
}

function LightningPay({ accountIndex }: { accountIndex: number }): JSX.Element {
  const [invoice, setInvoice] = useState('');
  const [maxFee, setMaxFee] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const decoded = invoice.trim() ? decodeBolt11(invoice.trim()) : null;

  async function pay(): Promise<void> {
    setError(null);
    if (!decoded) { setError('Paste a valid BOLT11 invoice (ln…).'); return; }
    const fee = Number(maxFee);
    if (!Number.isInteger(fee) || fee < 0) { setError('Max fee must be a whole number of sats.'); return; }
    setBusy(true);
    try {
      setDone(await send({ type: 'LIGHTNING_PAY_INVOICE', accountIndex, invoice: invoice.trim(), maxFeeSats: fee }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Payment failed.'); } finally { setBusy(false); }
  }
  if (done) {
    return (
      <div style={col}>
        <p style={okText}>✅ Payment sent.</p>
        <code style={addrCode}>{done}</code>
        <Button variant="secondary" onClick={() => { setDone(null); setInvoice(''); }} style={{ width: '100%' }}>Pay another</Button>
      </div>
    );
  }
  return (
    <div style={col}>
      <p style={note}>Pay a BOLT11 invoice from your Spark balance.</p>
      <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Paste a BOLT11 invoice (lnbc…)" />
      {decoded && (
        <div style={feePill}>
          <span style={{ opacity: 0.7 }}>{decoded.network}</span>
          <strong>{decoded.millisatoshis !== undefined ? `${(decoded.millisatoshis / 1000n).toString()} sats` : 'Any amount'}</strong>
        </div>
      )}
      <Input value={maxFee} onChange={(e) => setMaxFee(e.target.value)} placeholder="Max fee (sats)" inputMode="numeric" />
      {error && <div role="alert" style={errBox}>{error}</div>}
      <Button onClick={() => { void pay(); }} disabled={busy || !decoded} style={{ width: '100%' }}>{busy ? 'Paying…' : 'Pay invoice'}</Button>
    </div>
  );
}

// ─────────────────────────────── shared bits ────────────────────────────────

function Segmented({ options, value, onChange }: { options: Array<[string, string]>; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(([v, label]) => (
        <Button key={v} size="sm" variant={value === v ? 'primary' : 'secondary'} onClick={() => onChange(v)} style={{ flex: 1 }}>
          {label}
        </Button>
      ))}
    </div>
  );
}

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const note: React.CSSProperties = { margin: 0, color: 'var(--text-secondary, #b3a79f)', fontSize: 13, textAlign: 'center', lineHeight: 1.4 };
const okText: React.CSSProperties = { margin: 0, textAlign: 'center', fontSize: 14 };
const err: React.CSSProperties = { margin: 0, color: 'var(--color-error, #ef4444)', fontSize: 13 };
const errBox: React.CSSProperties = { padding: '10px 12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, borderLeft: '3px solid var(--color-error, #EF4444)', fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4, wordBreak: 'break-word' };
const feePill: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-elevated-2)' };
const addrCode: React.CSSProperties = { wordBreak: 'break-all', fontSize: 11, color: 'var(--text-primary)', background: 'var(--bg-elevated-2)', padding: '8px 10px', borderRadius: 8, width: '100%' };
