/*
  Admin addresses and menu (Figma Admin page 1:5). Every admin page lives
  under /admin. The live admin is admin.omwinitiative.org: web/vercel.json
  sends its home page to /admin and forwards omwinitiative.org/admin there,
  so these links work unchanged on that address.
  Pages that read a record use ?id= (the site is static, so there is one
  page per screen, not one per record).
*/
import type { ImageMetadata } from 'astro';
import dashboard from '../assets/icons/admin/nav-dashboard.svg';
import donations from '../assets/icons/admin/nav-donations.svg';
import blog from '../assets/icons/admin/nav-blog.svg';
import gallery from '../assets/icons/admin/nav-gallery.svg';
import messages from '../assets/icons/admin/nav-messages.svg';
import settings from '../assets/icons/admin/nav-settings.svg';
// Not in the Figma admin (added 20 Oct 2026): Phosphor Regular, the design's icon set.
import team from '../assets/icons/admin/nav-team.svg';
import privacy from '../assets/icons/admin/nav-privacy.svg';
import faq from '../assets/icons/admin/nav-faq.svg';

export const adminPaths = {
  dashboard: '/admin',
  signIn: '/admin/sign-in',
  forgotPassword: '/admin/forgot-password',
  checkEmail: '/admin/check-email',
  resetPassword: '/admin/reset-password',
  donations: '/admin/donations',
  donation: '/admin/donations/details',
  recordTransfer: '/admin/donations/record',
  blog: '/admin/blog',
  editPost: '/admin/blog/edit',
  gallery: '/admin/gallery',
  messages: '/admin/messages',
  message: '/admin/messages/view',
  team: '/admin/team',
  faq: '/admin/faq',
  privacy: '/admin/privacy-policy',
  settings: '/admin/settings',
} as const;

export type AdminSection =
  | 'dashboard'
  | 'donations'
  | 'blog'
  | 'gallery'
  | 'messages'
  | 'team'
  | 'faq'
  | 'privacy'
  | 'settings';

export const adminNav: { section: AdminSection; label: string; href: string; icon: ImageMetadata }[] = [
  { section: 'dashboard', label: 'Dashboard', href: adminPaths.dashboard, icon: dashboard },
  { section: 'donations', label: 'Donations', href: adminPaths.donations, icon: donations },
  { section: 'blog', label: 'Blog posts', href: adminPaths.blog, icon: blog },
  { section: 'gallery', label: 'Gallery', href: adminPaths.gallery, icon: gallery },
  { section: 'messages', label: 'Messages', href: adminPaths.messages, icon: messages },
  { section: 'team', label: 'Team', href: adminPaths.team, icon: team },
  { section: 'faq', label: 'FAQ', href: adminPaths.faq, icon: faq },
  { section: 'privacy', label: 'Privacy Policy', href: adminPaths.privacy, icon: privacy },
  { section: 'settings', label: 'Settings', href: adminPaths.settings, icon: settings },
];
