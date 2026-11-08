import type { UserRole } from '../types';

export const hasRole = (role: UserRole | null | undefined, allowedRoles: readonly UserRole[]): boolean =>
  !!role && allowedRoles.includes(role);

export const isRoleAllowed = hasRole;
