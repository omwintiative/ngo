/*
  Every link in the site header and footer, in one place.

  Labels are copied exactly from the Figma file (Header 37:97, Footer 37:264).
  Internal paths approved by Ifeanyi in step 4 (18 Oct 2026). To change one,
  change it here only and every page follows.

  External links come from the Figma prototype links (read 18 Oct 2026).
*/

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  /** Used for the dropdown's id, e.g. "get-involved". */
  id: string;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

/** Internal pages, named after the Hi-fi design pages. */
export const paths = {
  home: '/',
  about: '/about',
  programmes: '/programmes',
  gallery: '/gallery',
  blog: '/blog',
  // Figma page "Join the Movement" (its heading is "Volunteer with Us")
  volunteer: '/join-the-movement',
  // Figma page "Partner or Sponsor"
  partner: '/partner-or-sponsor',
  contact: '/contact',
  donate: '/donate',
  contributors: '/contributors',
  privacy: '/privacy-policy',
} as const;

/** Off-site links. Only links that appear in the Figma file. */
export const externalLinks = {
  // "Volunteer With Us" button on Join the Movement (Figma 94:4248)
  volunteerForm:
    'https://docs.google.com/forms/d/e/1FAIpQLSdbpXDuJbrMGJEiHPKb402GyS_8yeMM3oNxjU5d-rRlobGIgg/viewform',
  // "Become a Partner or Sponsor" button on Partner or Sponsor (Figma 94:4654)
  partnerForm: 'https://forms.gle/AbDFBENZBv6YzsXYA',
  // TODO: social media. The Figma file has Facebook, Instagram, LinkedIn and
  // WhatsApp icons but no page uses them and no addresses are given.
  social: [] as NavLink[],
} as const;

/** Contact details exactly as shown in the Figma footer. */
export const contact = {
  location: 'Abuja, Nigeria',
  email: 'info@omwinitiative.org',
  emailHref: 'mailto:info@omwinitiative.org',
  phone: '+234 905 684 9780',
  phoneHref: 'tel:+2349056849780',
} as const;

const getInvolvedLinks: NavLink[] = [
  { label: 'Volunteer with Us', href: paths.volunteer },
  { label: 'Partner / Sponsor', href: paths.partner },
];

/** Header links, in Figma order. */
export const mainNav: NavItem[] = [
  { label: 'Home', href: paths.home },
  { label: 'About Us', href: paths.about },
  { label: 'Programmes', href: paths.programmes },
  { label: 'Gallery', href: paths.gallery },
  { label: 'Blog', href: paths.blog },
  { label: 'Get Involved', id: 'get-involved', children: getInvolvedLinks },
  { label: 'Contact', href: paths.contact },
];

/** The header's Donate button: full label on desktop, short label on tablet and mobile. */
export const donateCta = {
  label: 'Donate Now',
  compactLabel: 'Donate',
  href: paths.donate,
} as const;

/** Footer link columns, in Figma order. */
export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: 'Quick Links',
    links: [
      { label: 'About Us', href: paths.about },
      { label: 'Programmes', href: paths.programmes },
      { label: 'Gallery', href: paths.gallery },
      { label: 'Blog', href: paths.blog },
      { label: 'Contributors', href: paths.contributors },
    ],
  },
  {
    title: 'Get Involved',
    links: [...getInvolvedLinks, { label: 'Donate', href: paths.donate }],
  },
];

export const legalLinks: NavLink[] = [{ label: 'Privacy Policy', href: paths.privacy }];

/** True when `href` is the page at `pathname` (ignores a trailing slash). */
export function isCurrent(href: string, pathname: string): boolean {
  const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  return clean(href) === clean(pathname);
}
