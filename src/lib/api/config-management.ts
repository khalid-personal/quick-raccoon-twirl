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