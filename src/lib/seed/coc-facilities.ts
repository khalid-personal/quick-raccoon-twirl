import { v4 as uuidv4 } from 'uuid';
import { CocFacility } from '../types';

export const SEED_COC_FACILITIES: CocFacility[] = [
    { id: uuidv4(), name: 'COC Training Center A', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'COC Training Center B', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'COC Training Center C', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'COC Training Center D', created_at: new Date().toISOString() },
];