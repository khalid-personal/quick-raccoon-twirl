import { AppConfig } from '../types';
import { SEED_COC_FACILITIES } from './coc-facilities';
import { SEED_FOREIGN_AGENCIES } from './foreign-agencies';
import { SEED_LOCAL_AGENCIES } from './local-agencies';

export const SEED_CONFIG: AppConfig = {
    countryOptions: ['Ethiopia', 'Djibouti', 'Somalia', 'Kenya', 'Eritrea', 'Sudan', 'Yemen', 'Uganda', 'Other'],
    cocFacilities: SEED_COC_FACILITIES,
    foreignAgencies: SEED_FOREIGN_AGENCIES,
    localAgencies: SEED_LOCAL_AGENCIES,
};