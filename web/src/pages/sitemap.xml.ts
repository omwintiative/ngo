/*
  /sitemap.xml for search engines (listed in public/robots.txt): the public
  pages, built with the site. Blog posts load from the API in the browser,
  so they are not listed here; search engines find them through the Blog page.
*/
import type { APIRoute } from 'astro';
import { paths } from '../config/navigation';

const pages = [
  paths.home,
  paths.about,
  paths.programmes,
  paths.gallery,
  paths.blog,
  paths.volunteer,
  paths.partner,
  paths.contact,
  paths.donate,
  paths.contributors,
  paths.privacy,
];

export const GET: APIRoute = ({ site }) => {
  const urls = pages.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
