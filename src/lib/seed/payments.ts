import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../types';
import { SEED_CANDIDATES } from './candidates';
import { SEED_FOREIGN_AGENCIES } from './foreign-agencies';
import { SEED_LOCAL_AGENCIES } from './local-agencies';

// Helper to get IDs from seed data
const getCandidateIdByTrackingCode = (trackingCode: string) => SEED_CANDIDATES.find(c => c.tracking_code === trackingCode)?.id;
const getForeignAgencyIdByName = (name: string) => SEED_FOREIGN_AGENCIES.find(fa => fa.name === name)?.id;
const getLocalAgencyIdByName = (name: string) => SEED_LOCAL_AGENCIES.find(la => la.name === name)?.id;

export const SEED_PAYMENTS: Payment[] = [
    {
        id: uuidv4(),
        stripe_payment_intent_id: 'pi_mock_001',
        amount: 2000,
        currency: 'ETB',
        status: 'succeeded',
        payer_foreign_agency_id: getForeignAgencyIdByName('Al-Aman Recruitment')!,
        payee_local_agency_id: getLocalAgencyIdByName('NuraLink')!,
        candidate_ids: [getCandidateIdByTrackingCode('TRK-ET-0001')!],
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
        updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
        id: uuidv4(),
        stripe_payment_intent_id: 'pi_mock_002',
        amount: 3000,
        currency: 'ETB',
        status: 'pending',
        payer_foreign_agency_id: getForeignAgencyIdByName('Gulf Manpower Solutions')!,
        payee_local_agency_id: getLocalAgencyIdByName('Local Agency X')!,
        candidate_ids: [getCandidateIdByTrackingCode('TRK-ET-0002')!, getCandidateIdByTrackingCode('TRK-ET-0004')!],
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
        updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
];