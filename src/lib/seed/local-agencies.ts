import { v4 as uuidv4 } from 'uuid';
import { LocalAgency } from '../types';

export const SEED_LOCAL_AGENCIES: LocalAgency[] = [
    { id: uuidv4(), name: 'Local Agency X', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Local Agency Y', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Local Agency Z', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'NuraLink', created_at: new Date().toISOString() },
];