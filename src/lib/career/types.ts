/**
 * Career / recruitment types.
 * Shared between public careers page and admin.
 */

export const CAREER_FIELD_TYPES = [
  'text',
  'email',
  'age',
  'phone',
  'date',
  'link',
  'textarea',
  'number',
  'select',
  'file',
] as const;

/** Predefined field labels admin can pick from; key is derived from label. */
export const CAREER_PREDEFINED_FIELD_NAMES = [
  'Full name',
  'Email',
  'Phone',
  'Gender',
  'Age',
  'City',
  'LinkedIn',
  'Instagram',
  'Facebook',
  'GitHub',
  'Portfolio / Website',
  'Upload document',
  'Cover letter',
  'Availability',
  'Expected salary',
  'Years of experience',
  'Current company',
  'Education',
  'Other',
] as const;

/** Link field types for label/placeholder (stored in validation.linkType). */
export const CAREER_LINK_TYPES = [
  { value: 'website', label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'github', label: 'GitHub' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'other', label: 'Other' },
] as const;

export type CareerFieldType = (typeof CAREER_FIELD_TYPES)[number];

/** Default config for predefined labels: type, options, validation, default required, etc. */
export const CAREER_PREDEFINED_FIELD_CONFIG: Record<
  string,
  {
    field_type: CareerFieldType;
    required?: boolean;
    options?: string[];
    validation?: CareerFieldValidation;
  }
> = {
  'Full name': { field_type: 'text', required: true },
  Email: { field_type: 'email', required: true },
  Phone: { field_type: 'phone' },
  Gender: {
    field_type: 'select',
    options: ['Male', 'Female'],
  },
  Age: {
    field_type: 'age',
    validation: { min: 18 },
  },
  City: {
    field_type: 'select',
    options: [],
  },
  LinkedIn: {
    field_type: 'link',
    validation: { linkType: 'linkedin' },
  },
  Instagram: {
    field_type: 'link',
    validation: { linkType: 'instagram' },
  },
  Facebook: {
    field_type: 'link',
    validation: { linkType: 'facebook' },
  },
  GitHub: {
    field_type: 'link',
    validation: { linkType: 'github' },
  },
  'Portfolio / Website': {
    field_type: 'link',
    validation: { linkType: 'portfolio' },
  },
  'Upload document': {
    field_type: 'file',
  },
  'Cover letter': { field_type: 'textarea' },
  Availability: { field_type: 'text' },
  'Expected salary': { field_type: 'number' },
  'Years of experience': { field_type: 'number' },
  'Current company': { field_type: 'text' },
  Education: { field_type: 'text' },
};

/** Job type options for domain (admin selects one or leaves empty). */
export const CAREER_JOB_TYPES = [
  "Full-time",
  "Part-time",
  "Freelance",
  "Per Project",
  "Internship",
  "Remote",
  "Volunteer",
] as const;

export type CareerJobType = (typeof CAREER_JOB_TYPES)[number];

export interface CareerDomain {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  benefits: string | null;
  job_type?: string | null;
  salary?: string | null;
  job_details?: string | null;
  applications_open: boolean;
  sort_order: number;
  document_upload_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Age field: validation.min, validation.max. Link field: validation.linkType (e.g. instagram, linkedin). */
export interface CareerFieldValidation {
  min?: number;
  max?: number;
  linkType?: string;
  [key: string]: unknown;
}

export interface CareerApplicationField {
  id: string;
  career_domain_id: string;
  field_key: string;
  label: string;
  field_type: CareerFieldType;
  required: boolean;
  sort_order: number;
  options: string[];
  validation: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CareerApplication {
  id: string;
  career_domain_id: string;
  form_data: Record<string, unknown>;
  status: 'new' | 'reviewed' | 'approved' | 'rejected';
  approved_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CareerApplicationLog {
  id: string;
  career_application_id: string;
  admin_id: string | null;
  admin_name?: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CareerDomainWithCount extends CareerDomain {
  applications_count?: number;
}

export interface CareerSettings {
  enabled: boolean;
}
