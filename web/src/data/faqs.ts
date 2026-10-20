/*
  Built-in FAQ lists, exactly as in Figma (Home 91:6838, Contact 94:5096).
  They show until the admin saves a list in Admin · FAQ, and are where the
  admin editor starts from.
*/
export interface FaqItem {
  question: string;
  answer: string;
}

const whatIsOmwi: FaqItem = {
  question: 'What is OMWI?',
  answer:
    'The Ọmụgwọ Maternal Welfare Initiative exists to ensure that women, regardless of their socio-economic status and geographical location, have access to the reproductive healthcare and literacy that they need and deserve.',
};
const meaning: FaqItem = {
  question: 'What does “ọmụgwọ” mean?',
  answer:
    'Ọmụgwọ is a traditional practice of the Igbo people in which a new mother is cared for in the early weeks after birth by her own mother or another woman in her family. That spirit of care is at the heart of our mission.',
};
const programmes: FaqItem = {
  question: 'What programmes does OMWI run?',
  answer:
    'We facilitate programmes that promote maternal health literacy, newborn care, menstrual health literacy and access to period products, mental health and wellness, and access to primary reproductive healthcare through local care providers.',
};
const volunteer: FaqItem = {
  question: 'How can I volunteer?',
  answer:
    'Fill in the volunteer application form on our Join the Movement page. We offer a variety of volunteer roles.',
};
const donate: FaqItem = {
  question: 'How do I donate?',
  answer:
    'Go to the Donate page, choose an amount and pay securely online. Any donation, no matter how big or small, is deeply appreciated.',
};

export const faqLists = {
  home: [whatIsOmwi, meaning, programmes, volunteer, donate],
  contact: [
    whatIsOmwi,
    meaning,
    programmes,
    {
      question: 'Who does OMWI serve?',
      answer: 'Women in underserved communities who lack access to reproductive healthcare and health education.',
    },
    volunteer,
    {
      question: 'How can my organisation partner with or sponsor OMWI?',
      answer:
        'Fill out the brief interest form on our Partner / Sponsor page and we will explore how we can work together.',
    },
    donate,
    {
      question: 'How can I contact OMWI?',
      answer: 'Call +234 905 684 9780 or email info@omwinitiative.org. You can also send a message from the Contact page.',
    },
  ],
} satisfies Record<string, FaqItem[]>;

export type FaqKey = keyof typeof faqLists;
