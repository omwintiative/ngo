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

/** "28 Sep 2026" (Nigerian time, wherever the admin is) */
export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

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

export type BadgeTone = 'success' | 'warning' | 'error' | 'neutral';

/** Status badge text and colour (Figma Admin/Badge: Success, Warning or Error). */
export function statusBadge(d: DonationLike): { label: string; tone: BadgeTone } {
  if (d.status === 'paid') return { label: d.method === 'paystack' ? 'Paid' : 'Received', tone: 'success' };
  if (d.status === 'not-completed') return { label: 'Not completed', tone: 'warning' };
  if (d.status === 'failed') return { label: 'Failed', tone: 'error' };
  return { label: 'Pending', tone: 'warning' };
}

export const badge = (label: string, tone: BadgeTone) => el('span', `admin-badge admin-badge--${tone} t-body-small`, label);

// The API takes JPEG, PNG or WebP photos of up to 5 MB.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_EDGE = 2400;

/**
  A photo ready to upload: the file itself when it is small enough, or a
  copy made smaller in the browser (at most 2400px on its longest side,
  JPEG) when it is over 5 MB, so phone and stock photos just work.
  Resolves null for files that are not JPEG, PNG or WebP photos.
*/
export async function preparePhoto(file: File): Promise<File | null> {
  if (!PHOTO_TYPES.includes(file.type)) return null;
  if (file.size <= MAX_PHOTO_BYTES) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d')!;
  // JPEG has no transparency: see-through parts of a PNG become white.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || blob.size > MAX_PHOTO_BYTES) return null;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}

/** A blog post as the admin API returns it (GET /api/admin/blogs). */
export interface AdminPost {
  _id: string;
  title: string;
  description: string;
  slug?: string;
  summary: string;
  category: string;
  status: 'draft' | 'published';
  publishAt?: string | null;
  publishedAt?: string;
  images: string[];
  imageAlt: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name?: string };
}

/** Draft, Published, or Scheduled (published with a later date: hidden until then). */
export function postBadge(post: Pick<AdminPost, 'status' | 'publishAt'>): { label: string; tone: BadgeTone } {
  if (post.status === 'draft') return { label: 'Draft', tone: 'neutral' };
  if (post.publishAt && new Date(post.publishAt) > new Date()) return { label: 'Scheduled', tone: 'warning' };
  return { label: 'Published', tone: 'success' };
}

/** The name the Contributors page shows: "Adaeze Okafor" -> "Adaeze O." (same rule as the API). */
export function publicName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? '';
  return `${words[0]} ${words[words.length - 1].charAt(0).toUpperCase()}.`;
}

/** "September 2026" */
export const formatMonth = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

/** "28 Sep 2026, 14:32" (Nigerian time) */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  });

/** An on/off switch (Figma Admin/Toggle) with an accessible name. */
export function makeSwitch(on: boolean, label: string): HTMLButtonElement {
  const button = el('button', 'admin-switch');
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', String(on));
  button.setAttribute('aria-label', label);
  return button;
}

/** The name the admin sees: "Anonymous" when the donor asked (Figma Admin · Dashboard). */
export const donorLabel = (d: DonationLike) => (d.anonymous ? 'Anonymous' : d.donorName);

/**
 * Ask before deleting (the layout's shared dialog). Resolves true only when
 * the red button is pressed; Cancel, Escape or a click outside resolve false.
 */
export function confirmAction(opts: { title: string; text: string; confirmLabel: string }): Promise<boolean> {
  const dialog = document.querySelector<HTMLDialogElement>('[data-admin-confirm]');
  if (!dialog) return Promise.resolve(false);
  dialog.querySelector('[data-confirm-title]')!.textContent = opts.title;
  dialog.querySelector('[data-confirm-text]')!.textContent = opts.text;
  dialog.querySelector('[data-confirm-button]')!.textContent = opts.confirmLabel;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }),
  );
}

/** Make an element with optional class and text: keeps API text out of innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
