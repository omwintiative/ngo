/*
  The five programme areas, used by the Programmes page index and sections.
  Copy as in Figma (Programmes 93:2438). Figma note: each programme shows
  only the text the client has supplied; what each one delivers, where and
  how often is still needed. The Newborn Care text is waiting for approval.
  The photos are stand-ins and do not show each programme.
*/
import type { ImageMetadata } from 'astro';
import maternalIcon from '../assets/icons/feature-maternal.svg';
import newbornIcon from '../assets/icons/feature-newborn.svg';
import menstrualIcon from '../assets/icons/feature-menstrual.svg';
import mentalIcon from '../assets/icons/feature-mental.svg';
import accessIcon from '../assets/icons/feature-access.svg';
import maternalPhoto from '../assets/photos/stock-programme-maternal.jpg';
import newbornPhoto from '../assets/photos/stock-programme-newborn.jpg';
import menstrualPhoto from '../assets/photos/stock-programme-menstrual.jpg';
import wellnessPhoto from '../assets/photos/stock-programme-wellness.jpg';
import accessPhoto from '../assets/photos/stock-programme-access.jpg';

export interface Programme {
  /** Section id, so the index can link to it. */
  id: string;
  number: string;
  title: string;
  text: string;
  icon: ImageMetadata;
  photo: ImageMetadata;
  photoAlt: string;
  fade: 'left' | 'top';
}

export const programmes: Programme[] = [
  {
    id: 'maternal-health',
    number: '01',
    title: 'Maternal Health',
    text: 'Bridging traditional wisdom with evidence-based educational material and workshops to support prenatal and postnatal holistic care.',
    icon: maternalIcon,
    photo: maternalPhoto,
    photoAlt: 'Women sitting in a circle outdoors, holding hands',
    fade: 'left',
  },
  {
    id: 'newborn-care',
    number: '02',
    title: 'Newborn Care',
    text: 'Practical guidance for mothers and families on caring for a newborn in the first weeks of life.',
    icon: newbornIcon,
    photo: newbornPhoto,
    photoAlt: 'A mother and her young child looking at a baby in a cot',
    fade: 'top',
  },
  {
    id: 'menstrual-health',
    number: '03',
    title: 'Menstrual Health',
    text: 'Delivering essential health literacy for menstrual health and menopausal transitions with dignity and informed support. We also promote access to period products.',
    icon: menstrualIcon,
    photo: menstrualPhoto,
    photoAlt: 'A smiling woman sitting on a sofa between a younger woman and a man',
    fade: 'left',
  },
  {
    id: 'mental-health-and-wellness',
    number: '04',
    title: 'Mental Health and Wellness',
    text: 'Creating space for maternal mental health resources and holistic wellness.',
    icon: mentalIcon,
    photo: wellnessPhoto,
    photoAlt: 'A woman meditating on a mat at home while two children play nearby',
    fade: 'top',
  },
  {
    id: 'healthcare-access',
    number: '05',
    title: 'Healthcare Access',
    text: 'We bridge the gap of the lack of access by partnering with local care providers to ensure primary reproductive healthcare is accessible and attainable.',
    icon: accessIcon,
    photo: accessPhoto,
    photoAlt: 'Three health workers sitting together, reviewing notes and a laptop',
    fade: 'left',
  },
];
