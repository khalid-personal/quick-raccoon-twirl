import { getConfig, saveConfig, getAuthorizationCodes, saveAuthorizationCodes } from '../data-store';
import { AppConfig } from '../data-seed';
import { recordApprovalLog } from './log-management';
import { v4 as uuidv4 } from 'uuid';
import { AuthorizationCode } from '../types';

// Get configuration
export const getAppConfig = async (): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getConfig();
};

// Update configuration
export const updateAppConfig = async (
    config: AppConfig,
    actorId: string, // NEW
    actorEmail: string // NEW
): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const oldConfig = getConfig();
    saveConfig(config);
    
    // --- LOGGING ---
    const oldCountries = oldConfig.countryOptions.filter(c => c !== 'Other').join(', ');
    const newCountries = config.countryOptions.filter(c => c !== 'Other').join(', ');
    
    const description = `Updated application configuration. Country list changed from [${oldCountries}] to [${newCountries}].`;
    
    await recordApprovalLog(actorId, actorEmail, 'Config', 'global_config', 'Updated', description);
    // --- END LOGGING ---
    
    return config;
};

// NEW: Get COC Agencies
export const getCocAgencies = async (): Promise<string[]> => {
    const config = await getAppConfig();
    return config.cocAgencies;
};

// NEW: Get Foreign Agencies
export const getForeignAgencies = async (): Promise<string[]> => {
    const config = await getAppConfig();
    return config.foreignAgencies;
};

// NEW: Mock function to select the least used COC agency
export const selectLeastUsedCocAgency = async (): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const agencies = await getCocAgencies();
    
    if (agencies.length === 0) {
        throw new Error("No COC agencies configured.");
    }
    
    // Mock logic: randomly select one, simulating load balancing
    const randomIndex = Math.floor(Math.random() * agencies.length);
    return agencies[randomIndex];
};

// NEW: Generate Authorization Code
export const generateAuthorizationCode = async (
    cocAgencyName: string | undefined,
    foreignAgencyName: string | undefined,
    actorId: string,
    actorEmail: string,
    expiresInDays?: number, // Optional expiry
    maxUses?: number // Optional max uses
): Promise<AuthorizationCode> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allCodes = getAuthorizationCodes();
    
    const newCode: AuthorizationCode = {
        code: uuidv4(),
        coc_agency_name: cocAgencyName,
        foreign_agency_name: foreignAgencyName,
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
    if (cocAgencyName) description += ` Linked to COC Agency: ${cocAgencyName}.`;
    if (foreignAgencyName) description += ` Linked to Foreign Agency: ${foreignAgencyName}.`;
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