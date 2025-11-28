import { v4 as uuidv4 } from 'uuid'; // NEW IMPORT
import { AuthorizationCode } from '../types';
import { getAuthorizationCodes as getAuthorizationCodesFromStore, saveAuthorizationCodes } from '../data-store';
import { recordApprovalLog } from './log-management';

// GET /api/admin/auth-codes
export const getAuthorizationCodes = async (): Promise<AuthorizationCode[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allCodes = await getAuthorizationCodesFromStore();
    return allCodes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
    const allCodes = await getAuthorizationCodesFromStore();
    
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
    const allCodes = await getAuthorizationCodesFromStore();
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