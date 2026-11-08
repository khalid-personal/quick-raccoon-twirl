export const createSyntheticPassportPdf = (): string => {
  const first = 'P<USAERIKSSON<<ANNA<MARIA'.padEnd(44, '<');
  const second = 'L898902C36USA7408122F1204159ZE184226B<<<<<10';
  const stream = `BT /F1 18 Tf 50 440 Td (SYNTHETIC PASSPORT TEST - NOT A REAL DOCUMENT) Tj ET
BT /F1 38 Tf 50 130 Td (${first}) Tj 0 -60 Td (${second}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}
trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
};
