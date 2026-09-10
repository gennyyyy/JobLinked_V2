export const locations = [
  'All Locations',
  'Poblacion',
  'Catmon',
  'Sto. Cristo',
  'Kaypian',
  'San Jose',
]

export const jobs = [
  {
    id: 1,
    title: 'Administrative Aide II',
    office: 'Municipal Government of Santa Maria',
    location: 'Poblacion',
    type: 'Full-time',
    salary: '₱25,000/mo',
    posted: 'Aug 19, 2026',
    applicants: 24,
    status: 'Open',
    description:
      'Provide administrative and clerical support to office operations, including records management, document preparation, and frontline assistance.',
    requirements: [
      'Bachelor degree or equivalent vocational course',
      'At least 1 year of relevant experience',
      'Proficient in MS Office applications',
      'Good communication skills',
    ],
  },
  {
    id: 2,
    title: 'Driver II',
    office: 'Santa Maria Water District',
    location: 'Catmon',
    type: 'Full-time',
    salary: '₱22,000/mo',
    posted: 'Aug 16, 2026',
    applicants: 9,
    status: 'Open',
    description:
      'Safely transport personnel and materials, maintain vehicle cleanliness, and perform routine vehicle checks.',
    requirements: [
      'Valid professional driver license (Restriction 1, 2)',
      'At least 2 years of driving experience',
      'Knowledge of traffic rules and basic vehicle maintenance',
      'Traffic violation-free record',
    ],
  },
  {
    id: 3,
    title: 'Laboratory Aide',
    office: 'Santa Maria Doctors Hospital',
    location: 'Sto. Cristo',
    type: 'Full-time',
    salary: '₱21,000/mo',
    posted: 'Aug 14, 2026',
    applicants: 12,
    status: 'Open',
    description:
      'Assist in laboratory preparation, cleaning of glassware and equipment, and safe handling of specimens under supervision.',
    requirements: [
      'Senior high school graduate or vocational course',
      'Willing to work on-site',
      'Attention to detail and safety protocols',
    ],
  },
  {
    id: 4,
    title: 'Tourism Operations Assistant',
    office: 'Municipal Tourism Office of Santa Maria',
    location: 'Kaypian',
    type: 'Contractual',
    salary: '₱20,000/mo',
    posted: 'Aug 12, 2026',
    applicants: 18,
    status: 'Open',
    description:
      'Support tourism promotion activities, assist visitors with inquiries, and help coordinate local tourism events.',
    requirements: [
      'Bachelor degree in Tourism or related field',
      'Strong interpersonal skills',
      'Willing to work weekends when needed',
    ],
  },
  {
    id: 5,
    title: 'Encoder III',
    office: 'Santa Maria Central School',
    location: 'San Jose',
    type: 'Contractual',
    salary: '₱24,000/mo',
    posted: 'Aug 10, 2026',
    applicants: 15,
    status: 'Open',
    description:
      'Encode and maintain accurate records and databases, prepare reports, and support day-to-day data management tasks.',
    requirements: [
      'Bachelor degree or equivalent vocational course',
      'Fast and accurate typing skills',
      'Experience with spreadsheets and encoding systems',
    ],
  },
]

export function getJob(id) {
  return jobs.find((job) => job.id === Number(id))
}
