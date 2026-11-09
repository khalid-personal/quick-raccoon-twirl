import { AppConfig } from '../types';
import { SEED_COC_FACILITIES } from './coc-facilities';
import { SEED_FOREIGN_AGENCIES } from './foreign-agencies';
import { SEED_LOCAL_AGENCIES } from './local-agencies';

export const SEED_CONFIG: AppConfig = {
    countryOptions: ['Ethiopia', 'Other'],
    cocFacilities: SEED_COC_FACILITIES,
    foreignAgencies: SEED_FOREIGN_AGENCIES,
    localAgencies: SEED_LOCAL_AGENCIES,
    agencyPartnerships: SEED_LOCAL_AGENCIES.flatMap((local, localIndex) => SEED_FOREIGN_AGENCIES.map((foreign, foreignIndex) => ({
        local_agency_id: local.id,
        foreign_agency_id: foreign.id,
        status: 'active' as const,
        agreement_reference: `DAWM-SEED-${localIndex + 1}-${foreignIndex + 1}`,
        started_at: new Date().toISOString(),
    }))),
    stageFees: { 1: 500, 2: 2200, 3: 2000, 4: 6000 },
    stageFeesInitialized: true,
    integrityScoreThresholds: { greenMin: 85, yellowMin: 60 },
};