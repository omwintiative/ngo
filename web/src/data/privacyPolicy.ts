/*
  Privacy Policy template, from Figma (208:7806), word for word. Every line in
  square brackets is for OMWI to replace with approved wording. The website
  shows this until the admin saves the real text (Admin · Privacy Policy),
  and the admin editor starts from it.
*/
export const intro = '[OMWI to supply the policy text. The headings below are a starting structure only.]';

export const sections = [
  {
    heading: 'What information we collect',
    text: '[To be supplied. For example: the name, email address and phone number entered on the Donate and Contact forms.]',
  },
  { heading: 'How we use your information', text: '[To be supplied by OMWI.]' },
  {
    heading: 'Payments',
    text: '[To be supplied. Payment is completed on Paystack’s checkout; confirm with Paystack what OMWI receives.]',
  },
  { heading: 'Who we share information with', text: '[To be supplied by OMWI.]' },
  { heading: 'How long we keep it', text: '[To be supplied by OMWI.]' },
  { heading: 'Your rights', text: '[To be supplied by OMWI.]' },
  {
    heading: 'Contact us about your data',
    text: '[To be supplied: the person and email address for privacy questions.]',
  },
];

/** The template in the editor's limited format (lib/postText.ts). */
export const templateText = [intro, ...sections.flatMap((s) => [`## ${s.heading}`, s.text])].join('\n\n');
