import { expect, test } from '@playwright/test';

async function openDemo(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'View as another user' }).click();
}

test('local agency dashboard shows only its candidates and usable links', async ({ page }) => {
  await openDemo(page);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Local agencies/ }) });
  await section.getByRole('button').first().click();
  await expect(page).toHaveURL(/\/local-agency$/);
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View payments' })).toHaveAttribute('href', '/local-agency/payments');
  const scope = await page.evaluate(() => {
    const target = JSON.parse(sessionStorage.getItem('dawm_view_as') || '{}');
    const candidates = JSON.parse(localStorage.getItem('dawm_demo_placeholder_candidates') || '[]');
    return candidates.filter((candidate: { local_agency_id: string }) => candidate.local_agency_id === target.localAgencyId)
      .map((candidate: { tracking_code: string }) => candidate.tracking_code);
  });
  await expect(page.getByRole('heading', { name: `Candidates (${scope.length})` })).toBeVisible();
  for (const code of scope.slice(0, 3)) await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
  await page.getByLabel('Search candidates').fill('no-such-candidate-123');
  await expect(page.getByText('No candidates found.')).toBeVisible();
});

test('foreign agency and staff views show their role-specific totals', async ({ page }) => {
  await openDemo(page);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Foreign agencies/ }) });
  await section.getByRole('button').first().click();
  await expect(page).toHaveURL(/\/agency$/);
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
  const expected = await page.evaluate(() => {
    const target = JSON.parse(sessionStorage.getItem('dawm_view_as') || '{}');
    const candidates = JSON.parse(localStorage.getItem('dawm_demo_placeholder_candidates') || '[]');
    return candidates.filter((candidate: { foreign_agency_id: string }) => candidate.foreign_agency_id === target.foreignAgencyId).length;
  });

  await expect(page.getByText('Candidates', { exact: true }).first().locator('..').getByText(String(expected), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View as another user' }).click();
  await page.getByRole('button', { name: /Staff Generic view of this role/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Your assigned candidates' })).toBeVisible();
});

test('viewer and auditor view-as routes open the appropriate dashboards', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: /Viewer Generic view of this role/ }).click();
  await expect(page).toHaveURL(/\/viewer$/);
  await expect(page.getByRole('heading', { name: 'Viewer dashboard' })).toBeVisible();
  await expect(page.getByLabel('Tracking code')).toBeVisible();
  const trackingCode = await page.evaluate(() => JSON.parse(localStorage.getItem('dawm_demo_placeholder_candidates') || '[]')[0].tracking_code as string);
  await page.getByLabel('Tracking code').fill(trackingCode);
  await page.getByRole('button', { name: 'Track candidate' }).click();
  await expect(page).toHaveURL(new RegExp(`/public-track/${trackingCode}$`));
  await expect(page.getByText(trackingCode, { exact: true }).first()).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'View as another user' }).click();
  await page.getByRole('button', { name: /Auditor Generic view of this role/ }).click();
  await expect(page).toHaveURL(/\/auditor$/);
  await expect(page.getByRole('heading', { name: /integrity/i }).first()).toBeVisible();
});

test('demo walkthrough highlights the portal and resumes after exit', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.getByRole('link', { name: 'Getting started' }).first().click();
  await page.getByRole('button', { name: 'Start portal walkthrough' }).click();
  const tour = page.getByRole('complementary', { name: 'Demo walkthrough' });
  await expect(page.locator('[data-tour="registration"]')).toHaveClass(/portal-tour-highlight/);
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('[data-tour="candidate-profile"]')).toHaveClass(/portal-tour-highlight/);
  await tour.getByRole('button', { name: 'Exit walkthrough' }).click();
  await expect(page.getByRole('heading', { name: 'Portal manual' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume portal walkthrough' }).click();
  await expect(tour.getByRole('heading', { name: 'Review the profile' })).toBeVisible();
});

test('network map filters each demo returnee group', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.goto('/admin/training-map');
  for (const [label, count] of [['Reapplying', 20], ['Eligible to reapply', 10], ['Redeployed', 5]] as const) {
    await page.getByRole('combobox', { name: 'Filter by return journey' }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.locator('#route-candidate').click();
    await expect(page.getByRole('option')).toHaveCount(count);
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('heading', { name: 'Previous employment journey' })).toBeVisible();
});

test('in-transit candidates have an eye that opens the flight tracker, and names open details', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.goto('/admin/training-map');
  const list = page.locator('[data-tour="deployment-map"]');
  await list.getByRole('button', { name: /Track flight for/ }).first().click();
  await expect(page.getByRole('dialog').getByText('Flight tracker')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/Scheduled|In flight|Landed/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await list.locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByRole('dialog').getByText('Passport')).toBeVisible();
});

test('agencies can register staff and superadmin can filter tasks by local agency', async ({ page }) => {
  await openDemo(page);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Local agencies/ }) });
  await section.getByRole('button').first().click();
  await page.goto('/local-agency/users');
  await page.getByRole('button', { name: 'Add Staff' }).click();
  await page.getByPlaceholder('new.staff@agency.com').fill('e2e.hire@demo-agency.example.test');
  await page.getByRole('button', { name: 'Create Staff Account' }).click();
  await expect(page.getByText('e2e.hire', { exact: false }).first()).toBeVisible();
});

test('dashboard and map tiles can be rearranged from the edit button and the layout persists', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await expect(page.getByRole('region', { name: 'Layout editor' })).toBeVisible();
  const first = page.locator('[aria-label$=" tile"]').first();
  const firstLabel = await first.getAttribute('aria-label');
  await page.getByRole('button', { name: /Move .* later/ }).first().click({ force: true });
  await expect(page.locator('[aria-label$=" tile"]').first()).not.toHaveAttribute('aria-label', firstLabel!);
  await page.getByRole('button', { name: 'Finish editing layout' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await expect(page.locator('[aria-label$=" tile"]').first()).not.toHaveAttribute('aria-label', firstLabel!);
  await page.getByRole('button', { name: 'Reset layout' }).click({ force: true });
  await expect(page.locator('[aria-label$=" tile"]').first()).toHaveAttribute('aria-label', firstLabel!);
});
