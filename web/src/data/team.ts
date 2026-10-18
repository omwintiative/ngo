/*
  OMWI team, shown on Home ("Meet the team") and later on About.

  Only people confirmed in the Figma file are listed. Figma has three more
  cards reading "Full name / Role": add them here when OMWI supplies the
  names, roles and portraits.

  `photo`: import a portrait from src/assets/photos and set it here. Without
  one, the card shows the plum placeholder from the Figma design.
*/
import type { ImageMetadata } from 'astro';

export interface TeamMember {
  name: string;
  role: string;
  photo?: ImageMetadata;
  /** Describe the portrait, e.g. "Chiamaka Osuji smiling, in a white top". */
  photoAlt?: string;
}

export const team: TeamMember[] = [
  // TODO: portrait not supplied yet.
  { name: 'Chiamaka Osuji, BScN, RN', role: 'Founder' },
];
