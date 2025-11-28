import { v4 as uuidv4 } from 'uuid';
import { ForeignAgency } from '../types';

export const SEED_FOREIGN_AGENCIES: ForeignAgency[] = [
    { id: uuidv4(), name: 'Al-Aman Recruitment', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Gulf Manpower Solutions', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Asia Star Agency', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Middle East Connect', created_at: new Date().toISOString() },
];