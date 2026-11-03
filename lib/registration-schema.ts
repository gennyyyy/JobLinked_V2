import { z } from 'zod'
import { BARANGAYS } from '@/constants'

export function registrationSchema(employer: boolean) {
  return z.object({
    name: z.string().min(2, 'Enter a name with at least 2 characters.').max(100),
    email: z.email('Enter a valid fictional email address.'),
    phone: z.string().regex(/^(?:\+63|0)9\d{9}$/, 'Use a Philippine mobile format, such as 09170000000.'),
    barangay: z.string().refine(v => BARANGAYS.includes(v), 'Choose one of Santa Maria’s 24 barangays.'),
    address: z.string().min(5, 'Enter a sample address of at least 5 characters.').max(200),
    companyName: employer ? z.string().min(2, 'Enter your sample company name.').max(100) : z.string(),
    industry: employer ? z.string().min(2, 'Choose an industry.') : z.string(),
    description: employer ? z.string().min(20, 'Describe the sample company in at least 20 characters.').max(1500) : z.string(),
    education: employer ? z.string() : z.string().min(3, 'Describe your highest educational attainment.').max(300),
    experience: z.string().max(1500),
    skills: employer ? z.string() : z.string().min(2, 'Add at least one skill.').max(300),
    password: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[0-9]/, 'Include a number.'),
    confirm: z.string().min(1, 'Confirm the sample password.'),
    privacyAcknowledged: z.boolean().refine(v => v, 'Acknowledge the full Privacy Notice to continue.'),
    termsAccepted: z.boolean().refine(v => v, 'Accept the draft demo terms to continue.'),
    representativeDeclared: employer ? z.boolean().refine(v => v, 'Confirm your authorized representative declaration.') : z.boolean(),
    processingConsent: employer ? z.boolean().refine(v => v, 'Provide the role-specific processing consent.') : z.boolean(),
  }).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'The sample passwords do not match.' })
}
export type RegistrationValues = z.infer<ReturnType<typeof registrationSchema>>
export const REGISTRATION_DEFAULTS: RegistrationValues = { name: '', email: '', phone: '', barangay: '', address: '', companyName: '', industry: '', description: '', education: '', experience: '', skills: '', password: '', confirm: '', privacyAcknowledged: false, termsAccepted: false, representativeDeclared: false, processingConsent: false }
