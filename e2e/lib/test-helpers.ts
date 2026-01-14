// Test Helper Functions for E2E Tests

import { type Page, expect } from '@playwright/test';
import { config, endpoints, selectors } from './config';
import * as api from './api-helpers';

// Navigation helpers
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

export async function navigateToHome(page: Page): Promise<void> {
  await navigateTo(page, endpoints.home);
}

export async function navigateToWatch(page: Page, slug: string): Promise<void> {
  await navigateTo(page, endpoints.watch(slug));
}

export async function navigateToEmbed(page: Page, slug: string): Promise<void> {
  await navigateTo(page, endpoints.embed(slug));
}

export async function navigateToAdmin(page: Page): Promise<void> {
  await navigateTo(page, endpoints.admin);
}

export async function navigateToAdminLogin(page: Page): Promise<void> {
  await navigateTo(page, endpoints.adminLogin);
}

export async function navigateToAuditLogs(page: Page): Promise<void> {
  await navigateTo(page, endpoints.adminAudit);
}

// Authentication helpers
export async function loginViaUI(page: Page, password: string = config.adminPassword): Promise<boolean> {
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set');
  }
  await navigateToAdminLogin(page);

  // Fill password - use click + pressSequentially for React controlled inputs
  const passwordInput = page.locator(selectors.loginPasswordInput);
  await passwordInput.click();
  await passwordInput.pressSequentially(password);

  // Click login
  await page.click(selectors.loginButton);

  // Wait for navigation or error
  await page.waitForTimeout(1000);

  // Check if we're on admin page (success) or still on login (failure)
  const url = page.url();
  return !url.includes('/login');
}

export async function logoutViaUI(page: Page): Promise<void> {
  // Try to find and click logout button
  const logoutButton = page.locator(selectors.logoutButton).first();
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
  }
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await navigateToAdmin(page);

  // If redirected to login, perform login
  if (page.url().includes('/login')) {
    const success = await loginViaUI(page);
    if (!success) {
      let errorText = '';
      const errorLocator = page.locator(selectors.loginError).first();
      if (await errorLocator.count()) {
        errorText = (await errorLocator.textContent())?.trim() || '';
      }
      if (!errorText) {
        const pageText = await getPageText(page);
        if (pageText.toLowerCase().includes('too many')) {
          errorText = 'Too many login attempts. Rate limited.';
        }
      }
      const suffix = errorText ? `: ${errorText}` : '';
      throw new Error(`Admin login failed${suffix}`);
    }
  }
}

export async function ensureLoggedOut(page: Page): Promise<void> {
  // Clear cookies to ensure logged out state
  await page.context().clearCookies();
}

// Stream management helpers
export async function createStreamViaUI(
  page: Page,
  data: {
    title: string;
    slug?: string;
    scheduledStart?: Date;
    loopCount?: number;
  }
): Promise<boolean> {
  await ensureLoggedIn(page);

  // Click create stream button
  const createButton = page.locator(selectors.createStreamButton).first();
  await createButton.click();

  // Wait for form
  await page.waitForSelector(selectors.titleInput);

  // Fill title
  await page.fill(selectors.titleInput, data.title);

  // Fill slug if provided
  if (data.slug) {
    const slugInput = page.locator(selectors.slugInput);
    if (await slugInput.isVisible()) {
      await slugInput.clear();
      await slugInput.fill(data.slug);
    }
  }

  // Fill scheduled start if provided
  if (data.scheduledStart) {
    const scheduledInput = page.locator(selectors.scheduledStartInput);
    if (await scheduledInput.isVisible()) {
      await scheduledInput.fill(data.scheduledStart.toISOString().slice(0, 16));
    }
  }

  // Fill loop count if provided
  if (data.loopCount) {
    const loopInput = page.locator(selectors.loopCountInput);
    if (await loopInput.isVisible()) {
      await loopInput.fill(data.loopCount.toString());
    }
  }

  // Submit form
  await page.click(selectors.submitButton);

  // Wait for response
  await page.waitForTimeout(1000);

  // Check for success (form closes or success message)
  const formStillVisible = await page.locator(selectors.titleInput).isVisible();
  return !formStillVisible;
}

export async function findStreamRow(page: Page, titleOrSlug: string): Promise<ReturnType<Page['locator']> | null> {
  const rows = page.locator(selectors.streamRow);
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const slug = await row.getAttribute("data-stream-slug");
    if (slug && slug === titleOrSlug) {
      return row;
    }
    const text = await row.textContent();
    if (text?.includes(titleOrSlug)) {
      return row;
    }
  }

  return null;
}

export async function clickStreamAction(
  page: Page,
  titleOrSlug: string,
  action: 'edit' | 'delete' | 'activate' | 'deactivate' | 'stop' | 'resume' | 'embed' | 'preview'
): Promise<boolean> {
  const row = await findStreamRow(page, titleOrSlug);
  if (!row) return false;

  const selectorMap: Record<string, string> = {
    edit: selectors.editButton,
    delete: selectors.deleteButton,
    activate: selectors.activateButton,
    deactivate: selectors.deactivateButton,
    stop: selectors.stopButton,
    resume: selectors.resumeButton,
    embed: selectors.embedButton,
    preview: selectors.previewButton,
  };

  const button = row.locator(selectorMap[action]).first();
  if (await button.isVisible()) {
    await button.click();
    return true;
  }

  return false;
}

export async function confirmDialog(page: Page): Promise<void> {
  const confirmButton = page.locator(selectors.confirmButton).first();
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
}

export async function cancelDialog(page: Page): Promise<void> {
  const cancelButton = page.locator(selectors.cancelConfirmButton).first();
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
  }
}

// Verification helpers
export async function verifyPageContains(page: Page, text: string): Promise<boolean> {
  const content = await page.content();
  return content.toLowerCase().includes(text.toLowerCase());
}

export async function verifyElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function verifyElementHidden(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function getPageText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

export async function waitForText(page: Page, text: string, timeout: number = 10000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (searchText) => document.body.innerText.toLowerCase().includes(searchText.toLowerCase()),
      text,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

// Time helpers
export function getFutureDate(hoursFromNow: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date;
}

export function getPastDate(hoursAgo: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
}

// Screenshot helpers
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const path = `./reports/screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

// Cleanup helpers
export async function cleanupTestStreams(): Promise<number> {
  const { streams } = await api.getStreams();
  let deleted = 0;

  for (const stream of streams) {
    if (stream.title.includes('E2E Test') || stream.slug.includes('e2e-test')) {
      const result = await api.deleteStream(stream.id);
      if (result.success) deleted++;
    }
  }

  return deleted;
}

// Assertion helpers
export async function assertUrlContains(page: Page, path: string): Promise<void> {
  expect(page.url()).toContain(path);
}

export async function assertUrlNotContains(page: Page, path: string): Promise<void> {
  expect(page.url()).not.toContain(path);
}

export async function assertVisible(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector).first()).toBeVisible();
}

export async function assertHidden(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector).first()).toBeHidden();
}

export async function assertTextPresent(page: Page, text: string): Promise<void> {
  await expect(page.locator('body')).toContainText(text, { ignoreCase: true });
}

export async function assertTextNotPresent(page: Page, text: string): Promise<void> {
  await expect(page.locator('body')).not.toContainText(text, { ignoreCase: true });
}
