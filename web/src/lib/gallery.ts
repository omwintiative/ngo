/*
  Gallery photos from the API (GET /api/gallery), managed in Admin ·
  Gallery. Used by the Gallery page, the Home photo strip and the admin.
*/
import { api } from './api';

export interface GalleryPhoto {
  id: string;
  url: string;
  name: string;
  alt: string;
  caption: string;
  onHome: boolean;
  width: number | null;
  height: number | null;
}

export const fetchGallery = () => api<GalleryPhoto[]>('/gallery');

/** The Home strip: photos marked for it (up to 6), or the first 6 when none are. */
export function homePhotos(photos: GalleryPhoto[]): GalleryPhoto[] {
  const marked = photos.filter((p) => p.onHome);
  return (marked.length ? marked : photos).slice(0, 6);
}

/**
  Points an <img> made by Photo.astro (a build-time image) at an API photo,
  with Cloudinary sizes for `srcset`.
*/
export function showPhoto(img: HTMLImageElement, photo: GalleryPhoto, widths: number[], alt: string) {
  img.srcset = widths.map((w) => `${sizedPhoto(photo.url, w)} ${w}w`).join(', ');
  img.src = sizedPhoto(photo.url, widths[widths.length - 1]);
  img.alt = alt;
  if (photo.width && photo.height) {
    img.width = photo.width;
    img.height = photo.height;
  }
}

/**
  A smaller copy of a Cloudinary photo: Cloudinary resizes when the size is
  written into the address (no wider than `width`, best format and quality
  for the browser). Other addresses are returned as they are.
*/
export function sizedPhoto(url: string, width: number): string {
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
    ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`)
    : url;
}
