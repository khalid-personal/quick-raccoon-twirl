export const toLoginEmail = (identifier: string): string => {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@agency.com`;
};
