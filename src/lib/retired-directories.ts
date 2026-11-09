import type { AppConfig } from './types';

const retiredNames = new Set([
  'coctrainingcentera', 'coctrainingcenterb', 'coctrainingcenterc', 'coctrainingcenterd',
  'nuralink', 'alaman', 'alamanrecruitment', 'gulfasia', 'gulfmanpowersolutions',
  'asiastaragency', 'middleeastconnect', 'middleeastconnection',
  'localagencyx', 'localagencyy', 'localagencyz',
]);
export const isRetiredDirectoryEntry = (entry: { name: string }) =>
  retiredNames.has(entry.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

export const activeDirectoryEntries = <T extends { name: string }>(entries: T[]): T[] =>
  entries.filter(entry => !isRetiredDirectoryEntry(entry));

export const activeDirectoryConfig = (config: AppConfig): AppConfig => {
  const retiredAgencyIds = new Set([...config.localAgencies, ...config.foreignAgencies]
    .filter(isRetiredDirectoryEntry).map(entry => entry.id));
  return {
    ...config,
    cocFacilities: activeDirectoryEntries(config.cocFacilities),
    localAgencies: activeDirectoryEntries(config.localAgencies),
    foreignAgencies: activeDirectoryEntries(config.foreignAgencies),
    agencyPartnerships: config.agencyPartnerships?.filter(item =>
      !retiredAgencyIds.has(item.local_agency_id) && !retiredAgencyIds.has(item.foreign_agency_id)),
  };
};
