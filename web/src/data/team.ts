/*
  OMWI team, shown on Home ("Meet the team") and About.

  Four cards, as in the Figma design. Only the first person is real: Figma
  shows the other three as "Full name / Role" placeholders (its note calls
  them sample content). Replace them with real names, roles and portraits
  before launch.

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
  // TODO before launch: Figma placeholders, waiting for real team members.
  { name: 'Full name', role: 'Role' },
  { name: 'Full name', role: 'Role' },
  { name: 'Full name', role: 'Role' },
];
