import type { Candidate } from './types';

const escapeXml = (value: string): string => value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character);

export const resolveProfileImage = (candidate: Pick<Candidate, 'profile_image_url' | 'passport_image_url' | 'first_name' | 'last_name'>): string => {
  if (candidate.profile_image_url && candidate.profile_image_url !== 'generated') return candidate.profile_image_url;
  if (candidate.passport_image_url && candidate.passport_image_url !== 'generated') return candidate.passport_image_url;
  const name = `${candidate.first_name ?? ''}${candidate.last_name ?? ''}`;
  const initials = escapeXml(`${candidate.first_name?.[0] ?? ''}${candidate.last_name?.[0] ?? ''}`.toUpperCase());
  const hue = [...name].reduce((value, character) => (value * 31 + character.charCodeAt(0)) % 360, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="hsl(${hue} 24% 42%)"/><text x="120" y="124" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="88" font-weight="600" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const fileToDataUrl = async (file: File, maxDimension = 1600, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('This file could not be read.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas is not available in this browser.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type.includes('png') ? 'image/png' : 'image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('That image could not be decoded.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
};

export const resolvePassportImage = (candidate: Pick<Candidate, 'passport_image_url'>): string | undefined => {
  return candidate.passport_image_url && candidate.passport_image_url !== 'generated' ? candidate.passport_image_url : undefined;
};
