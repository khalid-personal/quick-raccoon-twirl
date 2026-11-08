// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Candidate, PublicTrackingData } from '@/lib/types';
vi.mock('../EthiopiaMap', () => ({ default: () => createElement('div', { 'data-testid': 'home-map' }) }));
vi.mock('../RouteMap', () => ({ default: () => createElement('div', { 'data-testid': 'work-map' }) }));
import CandidateJourneyMap from '../CandidateJourneyMap';
import TrackingTimeline from '../TrackingTimeline';

const journey: PublicTrackingData['journey'] = {
  home_city: 'Adama', home_region: 'Oromia', home: { lat: 8.54, lon: 39.27, label: 'Adama' },
  facility: { lat: 9, lon: 38.7, label: 'Assigned CoC' },
  center: { name: 'Assigned CoC', city: 'Addis Ababa', address: 'Training street', phone_number: '+251111111111', contact_email: 'center@example.test' },
  destination: { lat: 24.7, lon: 46.6, label: 'Riyadh, Saudi Arabia' }, training_status: 'In Progress', deployment_status: 'Pending',
};
const candidate = { first_name: 'Demo', last_name: 'Candidate', tracking_code: 'TRK-TEST', phone_number: '+251900000000', external_status: { work_contract: true }, employer: { company: 'Employer household', contact_name: 'Employer contact', role: 'Sponsor', phone: '+966500000000', email: 'employer@example.test', address: 'Employer street' } } as Candidate;

describe('journey route side details', () => {
  it('places candidate and CoC information beside the home map and employer information beside the work map', () => {
    const html = renderToStaticMarkup(createElement(CandidateJourneyMap, { journey, candidate }));
    expect(html).toContain('Home to CoC journey');
    expect(html).toContain('Assigned CoC');
    expect(html).toContain('center@example.test');
    expect(html).toContain('TRK-TEST');
    expect(html).toContain('Work destination journey');
    expect(html).toContain('Employer household');
    expect(html).toContain('employer@example.test');
  });

  describe('candidate journey payment status', () => {
    const timeline: PublicTrackingData['timeline'] = [{
      stage_id: 1,
      title: 'Registration',
      status: 'In Progress',
      is_medical_stage: false,
      documents: [],
      fee_amount: 500,
      is_fee_paid: false,
    }];

    it('shows an unpaid icon and label for stages with outstanding fees', () => {
      const html = renderToStaticMarkup(createElement(TrackingTimeline, {
        timeline,
        isPublicView: false,
        trackingCode: 'TRK-TEST',
        refetch: () => undefined,
      }));

      expect(html).toContain('Stage fee unpaid');
      expect(html).toContain('Unpaid');
    });

    it('shows a paid icon and label after the stage fee is paid', () => {
      const html = renderToStaticMarkup(createElement(TrackingTimeline, {
        timeline: [{ ...timeline[0], is_fee_paid: true }],
        isPublicView: false,
        trackingCode: 'TRK-TEST',
        refetch: () => undefined,
      }));

      expect(html).toContain('Stage fee paid');
      expect(html).toContain('Paid');
    });
  });
  it('does not expose candidate contacts or employer details without the authenticated candidate record', () => {
    const html = renderToStaticMarkup(createElement(CandidateJourneyMap, { journey }));
    expect(html).not.toContain('employer@example.test');
    expect(html).not.toContain('+251900000000');
    expect(html).toContain('Employer contact details are available in the candidate account');
    expect(html).toContain('Assigned CoC');
  });
});