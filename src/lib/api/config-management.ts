import { getConfig, saveConfig } from '../data-store';
import { AppConfig } from '../data-seed';

// Get configuration
export const getAppConfig = async (): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getConfig();
};

// Update configuration
export const updateAppConfig = async (config: AppConfig): Promise<AppConfig> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    saveConfig(config);
    return config;
};

// NEW: Get COC Agencies
export const getCocAgencies = async (): Promise<string[]> => {
    const config = await getAppConfig();
    return config.cocAgencies;
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