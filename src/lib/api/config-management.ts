import { getConfig, saveConfig, getAuthorizationCodes, saveAuthorizationCodes, getCocFacilities, getForeignAgencies, getLocalAgencies, saveCocFacilities, saveForeignAgencies, saveLocalAgencies } from '../data-store';
import { AppConfig, SEED_CONFIG } from '../data-seed';
import { recordApprovalLog } from './log-management';
import { v4 as uuidv4 } from 'uuid';
import { AuthorizationCode, CocFacility, ForeignAgency, LocalAgency } from '../types';

// Get configuration
export const getAppConfig = async (): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getConfig();
};

// Update configuration
export const updateAppConfig = async (
    config: AppConfig,
    actorId: string,
    actorEmail: string
): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const oldConfig = getConfig();
    saveConfig(config);
    
    // --- LOGGING ---
    const oldCountries = oldConfig.countryOptions.filter(c => c !== 'Other').join(', ');
    const newCountries = config.countryOptions.filter(c => c !== 'Other').join(', ');
    
    const oldCocFacilities = oldConfig.cocFacilities.map(f => f.name).join(', ');
    const newCocFacilities = config.cocFacilities.map(f => f.name).join(', ');

    const oldForeignAgencies = oldConfig.foreignAgencies.map(a => a.name).join(', ');
    const newForeignAgencies = config.foreignAgencies.map(a => a.name).join(', ');

    const oldLocalAgencies = oldConfig.localAgencies.map(a => a.name).join(', ');
    const newLocalAgencies = config.localAgencies.map(a => a.name).join(', ');
    
    let description = `Updated application configuration.`;
    if (oldCountries !== newCountries) description += ` Country list changed from [${oldCountries}] to [${newCountries}].`;
    if (oldCocFacilities !== newCocFacilities) description += ` COC Facilities changed from [${oldCocFacilities}] to [${newCocFacilities}].`;
    if (oldForeignAgencies !== newForeignAgencies) description += ` Foreign Agencies changed from [${oldForeignAgencies}] to [${newForeignAgencies}].`;
    if (oldLocalAgencies !== newLocalAgencies) description += ` Local Agencies changed from [${oldLocalAgencies}] to [${newLocalAgencies}].`;

    await recordApprovalLog(actorId, actorEmail, 'Config', 'global_config', 'Updated', description);
    // --- END LOGGING ---
    
    return config;
};

// NEW: Get COC Facilities
export const getCocFacilityList = async (): Promise<CocFacility[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getCocFacilities();
};

// NEW: Get Foreign Agencies
export const getForeignAgencyList = async (): Promise<ForeignAgency[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getForeignAgencies();
};

// NEW: Get Local Agencies
export const getLocalAgencyList = async (): Promise<LocalAgency[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getLocalAgencies();
};

// NEW: Mock function to select the least used COC facility
export const selectLeastUsedCocFacility = async (): Promise<CocFacility> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const facilities = await getCocFacilityList();
    
    if (facilities.length === 0) {
        throw new Error("No COC facilities configured.");
    }
    
    // Mock logic: randomly select one, simulating load balancing
    const randomIndex = Math.floor(Math.random() * facilities.length);
    return facilities[randomIndex];
};

// NEW: Generate Authorization Code
export const generateAuthorizationCode = async (
    localAgencyId: string | undefined, // Changed from cocAgencyName
    foreignAgencyId: string | undefined, // Changed from foreignAgencyName
    actorId: string,
    actorEmail: string,
    expiresInDays?: number, // Optional expiry
    maxUses?: number // Optional max uses
): Promise<AuthorizationCode> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allCodes = getAuthorizationCodes();
    
    const newCode: AuthorizationCode = {
        code: uuidv4(),
        local_agency_id: localAgencyId, // Changed
        foreign_agency_id: foreignAgencyId, // Changed
        created_by_admin_id: actorId,
        created_at: new Date().toISOString(),
        expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
        is_active: true,
        usage_count: 0,
        max_uses: maxUses,
    };

    allCodes.push(newCode);
    saveAuthorizationCodes(allCodes);

    let description = `Generated new authorization code: ${newCode.code}.`;
    if (localAgencyId) {
        const localAgency = getLocalAgencies().find(la => la.id === localAgencyId);
        description += ` Linked to Local Agency: ${localAgency?.name || localAgencyId}.`;
    }
    if (foreignAgencyId) {
        const foreignAgency = getForeignAgencies().find(fa => fa.id === foreignAgencyId);
        description += ` Linked to Foreign Agency: ${foreignAgency?.name || foreignAgencyId}.`;
    }
    if (expiresInDays) description += ` Expires in ${expiresInDays} days.`;
    if (maxUses) description += ` Max uses: ${maxUses}.`;

    await recordApprovalLog(actorId, actorEmail, 'AuthorizationCode', newCode.code, 'Created', description);

    return newCode;
};

// NEW: Validate Authorization Code
export const validateAuthorizationCode = async (code: string): Promise<AuthorizationCode> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const allCodes = getAuthorizationCodes();
    const authCode = allCodes.find(ac => ac.code === code);

    if (!authCode) {
        throw new Error("Invalid authorization code.");
    }
    if (!authCode.is_active) {
        throw new Error("Authorization code is inactive.");
    }
    if (authCode.expires_at && new Date(authCode.expires_at) < new Date()) {
        throw new Error("Authorization code has expired.");
    }
    if (authCode.max_uses !== undefined && authCode.usage_count >= authCode.max_uses) {
        throw new Error("Authorization code has reached its maximum usage limit.");
    }

    // Increment usage count (mock update)
    authCode.usage_count++;
    saveAuthorizationCodes(allCodes); // Persist the change

    return authCode;
};