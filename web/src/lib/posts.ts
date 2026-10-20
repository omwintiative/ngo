/*
  Blog posts from the API (GET /api/blogs, GET /api/blogs/:idOrSlug), and
  the shared post card used on Home, Blog and Blog post. The card shows a
  category only when a post has one.
*/
import { api } from './api';
import { postHref } from '../config/navigation';

export interface Post {
  _id: string;
  title: string;
  description: string;
  images?: string[];
  category?: string;
  slug?: string;
  summary?: string;
  imageAlt?: string;
  publishAt?: string | null;
  publishedAt?: string;
  authorName?: string;
  createdAt: string;
  createdBy?: { name?: string };
}

/** The author shown on a post: the name typed in the admin, or the admin account's. */
export const postAuthor = (post: Pick<Post, 'authorName' | 'createdBy'>) => post.authorName || post.createdBy?.name || '';

export const fetchPosts = () => api<Post[]>('/blogs');
export const fetchPost = (idOrSlug: string) => api<Post>(`/blogs/${encodeURIComponent(idOrSlug)}`);

/** The date readers see: the publish date, or when it was written. */
export const postDate = (post: Post) => post.publishAt || post.publishedAt || post.createdAt;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatDate(iso: string): { text: string; iso: string } | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : { text: dateFormat.format(date), iso: date.toISOString().slice(0, 10) };
}

/** Only web addresses or site paths are used as image sources. */
export function safeImage(src: string | undefined): string | undefined {
  return src && (/^https:\/\//.test(src) || src.startsWith('/')) ? src : undefined;
}

/**
  Builds one post card from the <template id="post-card-template"> that
  PostCardTemplate.astro puts on the page. Text goes in with textContent.
*/
export function renderPostCard(post: Post): HTMLElement {
  const template = document.getElementById('post-card-template') as HTMLTemplateElement;
  const card = template.content.firstElementChild!.cloneNode(true) as HTMLElement;

  const category = card.querySelector<HTMLElement>('[data-post-category]')!;
  if (post.category) category.textContent = post.category;
  else category.remove();

  card.querySelector('[data-post-title]')!.textContent = post.title;

  const time = card.querySelector<HTMLTimeElement>('[data-post-date]')!;
  const date = formatDate(postDate(post));
  if (date) {
    time.dateTime = date.iso;
    time.textContent = date.text;
  }

  const img = card.querySelector<HTMLImageElement>('[data-post-img]')!;
  const src = safeImage(post.images?.[0]);
  if (src) img.src = src;
  else img.remove();

  const link = card.querySelector<HTMLAnchorElement>('[data-post-link]')!;
  link.href = postHref(post);
  link.setAttribute('aria-label', `Read article: ${post.title}`);
  return card;
}
