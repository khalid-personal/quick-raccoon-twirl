import * as z from 'zod';
import { api } from '@/lib/api';

// --- Constants ---
export const NEW_BATCH_OPTION = '___NEW_BATCH___';
export const NO_BATCH_OPTION = '___NO_BATCH___'; // Non-empty string constant for 'No Batch'
export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'];
export const NONE_SELECT_VALUE = "none"; // Consistent value for 'None' in selects

// --- Helper Functions ---
// Helper function to check if DOB is 18+
export const isAdult = (dob: string): boolean => {
    const birthDate = new Date(dob);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) >= 18;
};

// --- Zod Schema ---
export const NewCandidateSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  dob: z.string().min(1, "Date of Birth is required."),
  passport_number: z.string().min(1, "Passport number is required."),
  tracking_code: z.string().min(1, "Tracking code is required.").regex(/^TRK-[A-Z]{2,3}-\d{4,}$/, "Invalid tracking code format (e.g., TRK-ET-0001)."),
  country_of_origin: z.string().min(1, "Country of origin is required."),
  marital_status: z.enum(MARITAL_STATUS_OPTIONS as [string, ...string[]], {
    required_error: "Marital status is required.",
  }),
  phone_number: z.string().optional(),
  email: z.string().email("Must be a valid email address.").min(1, "Email is required for candidate login."),
  coc_facility_id: z.string().min(1, "COC Facility is required."), // Changed to ID
  foreign_agency_id: z.string().optional(), // Changed to ID
  local_agency_id: z.string().min(1, "Local Agency is required."), // NEW FIELD: Link to the Local Agency that manages this candidate by ID
  custom_country: z.string().optional(),
  batch_name: z.string().optional(),
  new_batch_name: z.string().optional(),
  // profile_image_file: z.any().optional(), // No direct validation for file object here, handled by state
}).superRefine((data, ctx) => {
  // Age validation
  if (data.dob && !isAdult(data.dob)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Candidate must be 18 years or older.",
      path: ['dob'],
    });
  }
  
  if (data.country_of_origin === 'Other' && (!data.custom_country || data.custom_country.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify the country.",
      path: ['custom_country'],
    });
  }
  
  if (data.batch_name === NEW_BATCH_OPTION && (!data.new_batch_name || data.new_batch_name.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter a name for the new batch.",
      path: ['new_batch_name'],
    });
  }
});

export type NewCandidateFormValues = z.infer<typeof NewCandidateSchema>;