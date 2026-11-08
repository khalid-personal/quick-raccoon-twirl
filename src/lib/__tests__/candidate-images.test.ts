import { describe, expect, it } from 'vitest';
import { resolveProfileImage } from '../candidate-images';

describe('candidate list portraits', () => {
  const candidate = {
    first_name: 'Aster',
    last_name: 'Bekele',
    profile_image_url: 'generated',
    passport_image_url: 'generated',
  };

  it('uses the profile photo first, then a real passport photo', () => {
    expect(resolveProfileImage({ ...candidate, profile_image_url: '/profile.jpg' })).toBe('/profile.jpg');
    expect(resolveProfileImage({ ...candidate, passport_image_url: '/passport.jpg' })).toBe('/passport.jpg');
  });

  it('creates a personalized avatar when neither photo is stored', () => {
    const image = resolveProfileImage(candidate);
    expect(image).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(image)).toContain('AB');
  });
});
