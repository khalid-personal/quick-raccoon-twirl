import { getConfig, saveConfig } from '../data-store';
import { AppConfig } from '../data-seed';
import { recordApprovalLog } from './log-management'; // NEW IMPORT

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