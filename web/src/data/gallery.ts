/*
  Outreach photos for the Gallery page, in Figma order (Gallery 93:3395).

  These are the client's seven photos. Figma repeats them to fill a grid of
  12; the site shows each once. Figma note: publish photos of mothers and
  infants only with their consent; outreach names, dates and places are
  still needed, so there are no captions or filters yet.
  These show until the admin Gallery photos load from the API, and stay if
  the API cannot be reached (GalleryGrid.astro).
*/
import type { ImageMetadata } from 'astro';
import care from '../assets/photos/outreach-1.jpg';
import group from '../assets/photos/outreach-3.jpg';
import box from '../assets/photos/outreach-5.jpg';
import bench from '../assets/photos/outreach-6.jpg';
import hero from '../assets/photos/outreach-2.jpg';
import portrait from '../assets/photos/outreach-4.jpg';
import bw from '../assets/photos/mother-and-child.jpg';

export interface GalleryPhoto {
  src: ImageMetadata;
  alt: string;
}

export const galleryPhotos: GalleryPhoto[] = [
  { src: care, alt: 'Women with babies at an OMWI outreach while a volunteer hands out items' },
  { src: group, alt: 'A volunteer speaking with mothers and children seated on benches' },
  { src: box, alt: 'A smiling woman carrying a box of supplies at an outreach' },
  { src: bench, alt: 'A mother holding her sleeping baby, seated outdoors' },
  { src: hero, alt: 'Women seated on benches in a large hall during an OMWI outreach' },
  { src: portrait, alt: 'Mothers holding babies, seated along a bench at an outreach' },
  { src: bw, alt: 'A smiling mother holding her young child, in black and white' },
];
