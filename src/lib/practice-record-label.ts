const employers = ['Cedar Horizon Services', 'Olive Bridge Holdings', 'Atlas Crescent Group', 'Palm Harbor Partners'];
const contacts = ['Rami Nasser', 'Hana Salim', 'Sami Kareem', 'Maya Faris'];

export function practiceRecordLabel(value: string | undefined, practice: boolean): string | undefined {
  if (!practice || !value) return value;
  return value.replace(/DEMO Employer (\d+)/g, (_, index: string) => `${employers[Number(index) % employers.length]} ${index}`)
    .replace(/DEMO Sponsor (\d+)/g, (_, index: string) => contacts[Number(index) % contacts.length])
    .replace(/DEMO-(ELMIS|VISA|CONTRACT)-/g, 'FX-$1-')
    .replace(/\bDEMO(?: ONLY)?\b/gi, 'Practice').replace(/\bpretend\b/gi, 'fictional');
}
