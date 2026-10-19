/*
  Browser helpers shared by the admin pages: who is signed in, signing out,
  safe "go back to" addresses, and the wording and formats of the Figma
  Admin screens (amounts, dates, payment methods and status badges).
*/
import { api } from './api';
import { adminPaths } from '../config/admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** The signed-in user, or null when nobody is signed in. Throws if the API is unreachable. */
export async function currentUser(): Promise<AdminUser | null> {
  try {
    const { user } = await api<{ user: AdminUser }>('/auth/me');
    return user;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) return null;
    throw error;
  }
}

let adminCheck: Promise<AdminUser> | undefined;

/**
 * Signed-in pages call this before loading data. It resolves with the admin.
 * Anyone else is sent to Sign in (and back here afterwards), and the promise
 * never resolves, so the page does nothing more. Rejects if the API cannot
 * be reached. The layout and the page share one check.
 */
export function requireAdmin(): Promise<AdminUser> {
  adminCheck ??= currentUser().then((user) => {
    if (user?.role === 'admin') return user;
    if (user) {
      // Signed in, but not as the admin (an old site account): sign out.
      void signOut();
    } else {
      const here = window.location.pathname + window.location.search;
      window.location.replace(`${adminPaths.signIn}?next=${encodeURIComponent(here)}`);
    }
    return new Promise<AdminUser>(() => {});
  });
  return adminCheck;
}

/** The public site's home page, also when the admin runs on admin.omwinitiative.org. */
export function publicSiteHome(): string {
  const { protocol, hostname, port } = window.location;
  return hostname.startsWith('admin.') ? `${protocol}//${hostname.slice('admin.'.length)}${port ? `:${port}` : ''}/` : '/';
}

export async function signOut(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    window.location.assign(adminPaths.signIn);
  }
}

/** Only admin addresses on this site, so a link can never send someone elsewhere after signing in. */
export function safeNext(value: string | null): string {
  return value && /^\/admin(\/[\w\-/]*)?(\?[\w=&%.-]*)?$/.test(value) ? value : adminPaths.dashboard;
}

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
/** "₦10,000" */
export const formatNaira = (amount: number) => naira.format(amount);

/** "28 Sep 2026" */
export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Paystack's channel names, as the Figma screens write them.
const CHANNELS: Record<string, string> = {
  card: 'Card',
  bank: 'Bank',
  bank_transfer: 'Bank transfer',
  ussd: 'USSD',
  mobile_money: 'Mobile money',
  qr: 'QR',
  apple_pay: 'Apple Pay',
};

export interface DonationLike {
  method: 'paystack' | 'bank-transfer' | 'cash';
  channel?: string;
  status: 'pending' | 'paid' | 'failed' | 'not-completed';
  donorName: string;
  anonymous?: boolean;
}

/** "Paystack · Card", "Bank transfer (recorded)", "Cash (recorded)" */
export function methodLabel(d: DonationLike): string {
  if (d.method === 'bank-transfer') return 'Bank transfer (recorded)';
  if (d.method === 'cash') return 'Cash (recorded)';
  const channel = d.channel ? CHANNELS[d.channel] ?? d.channel : '';
  return channel ? `Paystack · ${channel}` : 'Paystack';
}

/** Status badge text and colour (Figma Admin/Badge: Success or Warning). */
export function statusBadge(d: DonationLike): { label: string; tone: 'success' | 'warning' } {
  if (d.status === 'paid') return { label: d.method === 'paystack' ? 'Paid' : 'Received', tone: 'success' };
  if (d.status === 'not-completed') return { label: 'Not completed', tone: 'warning' };
  if (d.status === 'failed') return { label: 'Failed', tone: 'warning' };
  return { label: 'Pending', tone: 'warning' };
}

/** The name the admin sees: "Anonymous" when the donor asked (Figma Admin · Dashboard). */
export const donorLabel = (d: DonationLike) => (d.anonymous ? 'Anonymous' : d.donorName);

/** Make an element with optional class and text: keeps API text out of innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
