import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3000';

test.describe('Dashboard Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and localStorage before each test
    await page.context().clearCookies();

    // Listen to console logs
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'log' || type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]:`, msg.text());
      }
    });
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    console.log('🔍 Testing: Redirect to login...');

    await page.goto(DASHBOARD_URL);

    // Should redirect to /login
    await page.waitForURL('**/login', { timeout: 5000 });

    console.log('✅ Redirected to login page');
    expect(page.url()).toContain('/login');

    // Check login page elements
    await expect(page.locator('h1')).toContainText('CTV Ad Server');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    console.log('✅ Login page elements are visible');
  });

  test('should login successfully and access dashboard', async ({ page }) => {
    console.log('🔍 Testing: Full login flow...');

    // Go to login page
    await page.goto(`${DASHBOARD_URL}/login`);
    console.log('📄 Loaded login page');

    // Fill in credentials
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    console.log('✅ Filled in credentials');

    // Click login button
    await page.click('button[type="submit"]');
    console.log('🔘 Clicked login button');

    // Wait for navigation to home page
    try {
      await page.waitForURL(/\/$/, { timeout: 10000 });
      console.log('✅ Navigated to home page');
    } catch (error) {
      console.error('❌ Failed to navigate to home page');
      console.error('Current URL:', page.url());

      // Check for error messages
      const errorElement = await page.locator('.bg-red-50, [class*="error"]').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.error('Error on page:', errorText);
      }

      throw error;
    }

    // Verify we're on the home page
    expect(page.url()).toMatch(/\/$/);

    // Check for dashboard elements
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
    console.log('✅ Home page loaded successfully');

    // Check sidebar navigation
    await expect(page.locator('nav a:has-text("Home")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Campaigns")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Analytics")')).toBeVisible();
    console.log('✅ Sidebar navigation visible');
  });

  test('should access campaigns page after login', async ({ page }) => {
    console.log('🔍 Testing: Campaigns page access...');

    // Login first
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    console.log('✅ Logged in');

    // Navigate to campaigns
    await page.click('text=Campaigns');
    await page.waitForURL('**/campaigns', { timeout: 5000 });
    console.log('✅ Navigated to campaigns page');

    expect(page.url()).toContain('/campaigns');

    // Check campaigns page elements
    await expect(page.locator('main h1')).toContainText('Campaigns');
    console.log('✅ Campaigns page title visible');

    // Should see search and filter
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    console.log('✅ Search and filter visible');
  });

  test('should logout successfully', async ({ page }) => {
    console.log('🔍 Testing: Logout flow...');

    // Login first
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    console.log('✅ Logged in');

    // Click logout
    await page.click('text=Logout');
    console.log('🔘 Clicked logout');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('✅ Redirected to login after logout');

    expect(page.url()).toContain('/login');
  });

  test('should show error on invalid credentials', async ({ page }) => {
    console.log('🔍 Testing: Invalid credentials...');

    await page.goto(`${DASHBOARD_URL}/login`);

    // Fill in wrong credentials
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    console.log('🔘 Attempted login with wrong credentials');

    // Should show error message
    await expect(page.locator('.bg-red-50, [class*="error"]')).toBeVisible({ timeout: 5000 });
    console.log('✅ Error message displayed');

    // Should still be on login page
    expect(page.url()).toContain('/login');
    console.log('✅ Still on login page');
  });

  test('should persist authentication after page refresh', async ({ page }) => {
    console.log('🔍 Testing: Auth persistence after refresh...');

    // Login
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    console.log('✅ Logged in');

    // Refresh the page
    await page.reload();
    console.log('🔄 Refreshed page');

    // Should still be on dashboard (not redirected to login)
    await page.waitForTimeout(2000); // Give it time to redirect if it's going to

    const currentUrl = page.url();
    console.log('Current URL after refresh:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.error('❌ FAILED: Redirected to login after refresh');
      console.error('This means cookies are not persisting!');
      throw new Error('Authentication not persisted after refresh');
    } else {
      console.log('✅ Still authenticated after refresh');
      expect(currentUrl).toMatch(/\/$/);
    }
  });
});

test.describe('API Integration', () => {
  test('should make authenticated API calls', async ({ page }) => {
    console.log('🔍 Testing: Authenticated API calls...');

    // Login
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });
    console.log('✅ Logged in');

    // Navigate to campaigns - this should trigger API call
    await page.click('text=Campaigns');
    await page.waitForURL('**/campaigns', { timeout: 5000 });
    console.log('✅ On campaigns page');

    // Wait for campaigns to load
    await page.waitForTimeout(2000);

    // Check if campaigns loaded or if there's an error
    const hasError = await page.locator('.bg-red-50, [class*="error"]').isVisible();

    if (hasError) {
      const errorText = await page.locator('.bg-red-50, [class*="error"]').textContent();
      console.error('❌ Error loading campaigns:', errorText);
      throw new Error(`Failed to load campaigns: ${errorText}`);
    }

    // Should see campaigns or empty state
    const hasTable = await page.locator('table').isVisible();
    const hasEmptyState = await page.locator('text=No campaigns found').isVisible();
    expect(hasTable || hasEmptyState).toBeTruthy();
    console.log('✅ Campaigns page loaded successfully');
  });
});

test.describe('Campaign Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and localStorage before each test
    await page.context().clearCookies();

    // Listen to console logs
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'log' || type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]:`, msg.text());
      }
    });

    // Login before each test
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });
  });

  test('should navigate to campaign creation form', async ({ page }) => {
    console.log('🔍 Testing: Navigate to campaign creation form...');

    // Navigate to campaigns page
    await page.click('text=Campaigns');
    await page.waitForURL('**/campaigns', { timeout: 5000 });
    console.log('✅ On campaigns page');

    // Click "New Campaign" button
    await page.click('text=New Campaign');
    await page.waitForURL('**/campaigns/new', { timeout: 5000 });
    console.log('✅ Navigated to campaign creation form');

    expect(page.url()).toContain('/campaigns/new');

    // Check form elements are visible
    await expect(page.locator('h1:has-text("Create Campaign")')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('input[name="budget_total"]')).toBeVisible();
    await expect(page.locator('input[name="start_date"]')).toBeVisible();
    await expect(page.locator('input[name="end_date"]')).toBeVisible();
    await expect(page.locator('select[name="pricing_model"]')).toBeVisible();
    await expect(page.locator('input[name="cpm_rate"]')).toBeVisible();
    console.log('✅ All form elements visible');
  });

  test('should show validation errors for empty form', async ({ page }) => {
    console.log('🔍 Testing: Form validation errors...');

    // Navigate to campaign creation form
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    console.log('✅ On campaign creation form');

    // Try to submit empty form
    await page.click('button:has-text("Create Campaign")');
    console.log('🔘 Submitted empty form');

    // Wait for validation errors to appear
    await page.waitForTimeout(500);

    // Check for validation errors
    const errorCount = await page.locator('text=/required|must be/i').count();
    expect(errorCount).toBeGreaterThan(0);
    console.log(`✅ Validation errors displayed (${errorCount} errors)`);
  });

  test('should create campaign with valid data', async ({ page }) => {
    console.log('🔍 Testing: Create campaign with valid data...');

    // Navigate to campaign creation form
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    console.log('✅ On campaign creation form');

    // Generate unique campaign name
    const timestamp = Date.now();
    const campaignName = `E2E Test Campaign ${timestamp}`;

    // Fill form with valid data
    await page.fill('input[name="name"]', campaignName);
    await page.fill('textarea[name="description"]', 'This is a test campaign created by E2E tests');
    await page.fill('input[name="budget_total"]', '10000');

    // Set dates (start date = today, end date = 7 days from now)
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);

    const startDate = today.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];

    await page.fill('input[name="start_date"]', startDate);
    await page.fill('input[name="end_date"]', endDate);

    // Fill pricing fields (CPM is the default)
    await page.fill('input[name="cpm_rate"]', '5.00');
    console.log('✅ Filled form with valid data');

    // Submit form
    await page.click('button:has-text("Create Campaign")');
    console.log('🔘 Submitted form');

    // Should redirect to campaigns list
    await page.waitForURL('**/campaigns', { timeout: 10000 });
    console.log('✅ Redirected to campaigns list');

    expect(page.url()).toContain('/campaigns');
    expect(page.url()).not.toContain('/campaigns/new');
  });

  test('should show error for invalid date range', async ({ page }) => {
    console.log('🔍 Testing: Invalid date range validation...');

    // Navigate to campaign creation form
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    console.log('✅ On campaign creation form');

    // Fill form with invalid date range (end date before start date)
    await page.fill('input[name="name"]', 'Invalid Date Campaign');
    await page.fill('input[name="budget_total"]', '5000');

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startDate = today.toISOString().split('T')[0];
    const endDate = yesterday.toISOString().split('T')[0];

    await page.fill('input[name="start_date"]', startDate);
    await page.fill('input[name="end_date"]', endDate);
    console.log('✅ Filled form with invalid date range');

    // Submit form
    await page.click('button:has-text("Create Campaign")');
    console.log('🔘 Submitted form');

    // Wait for validation error
    await page.waitForTimeout(500);

    // Should show validation error about date range
    await expect(page.locator('text=/End date must be after start date/i')).toBeVisible();
    console.log('✅ Date range validation error displayed');

    // Should still be on form page
    expect(page.url()).toContain('/campaigns/new');
  });

  test('should cancel campaign creation', async ({ page }) => {
    console.log('🔍 Testing: Cancel campaign creation...');

    // Navigate to campaign creation form
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    console.log('✅ On campaign creation form');

    // Fill some data
    await page.fill('input[name="name"]', 'Campaign to Cancel');
    console.log('✅ Filled partial data');

    // Click cancel button
    await page.click('text=Cancel');
    console.log('🔘 Clicked cancel');

    // Should redirect to campaigns list
    await page.waitForURL('**/campaigns', { timeout: 5000 });
    console.log('✅ Redirected to campaigns list');

    expect(page.url()).toContain('/campaigns');
    expect(page.url()).not.toContain('/campaigns/new');
  });

  test('should accept today as start date', async ({ page }) => {
    console.log('🔍 Testing: Today is valid start date...');

    // Navigate to campaign creation form
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    console.log('✅ On campaign creation form');

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    console.log(`Using today: ${todayStr}`);

    // Fill form with today as start date
    await page.fill('input[name="name"]', 'Today Start Date Campaign');
    await page.fill('input[name="budget_total"]', '5000');
    await page.fill('input[name="start_date"]', todayStr);
    await page.fill('input[name="end_date"]', futureDateStr);
    await page.fill('input[name="cpm_rate"]', '5.00');
    console.log('✅ Filled form with today as start date');

    // Submit form
    await page.click('button:has-text("Create Campaign")');
    console.log('🔘 Submitted form');

    // Should NOT show validation error for start date
    await page.waitForTimeout(500);

    const hasStartDateError = await page.locator('text=/Start date must be today or in the future/i').isVisible();
    expect(hasStartDateError).toBeFalsy();
    console.log('✅ No start date validation error (today is accepted)');

    // Should redirect to campaigns list
    await page.waitForURL('**/campaigns', { timeout: 10000 });
    console.log('✅ Successfully created campaign with today as start date');

    expect(page.url()).toContain('/campaigns');
    expect(page.url()).not.toContain('/campaigns/new');
  });
});

test.describe('Creative Upload', () => {
  let campaignId: string;

  test.beforeEach(async ({ page }) => {
    // Clear cookies and localStorage before each test
    await page.context().clearCookies();

    // Listen to console logs
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'log' || type === 'error' || type === 'warning') {
        console.log(`[Browser ${type}]:`, msg.text());
      }
    });

    // Login before each test
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.fill('input[type="email"]', 'advertiser@adserver.dev');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 10000 });

    // Create a test campaign
    await page.goto(`${DASHBOARD_URL}/campaigns/new`);
    const timestamp = Date.now();
    const campaignName = `Creative Test Campaign ${timestamp}`;

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);
    const startDate = today.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];

    await page.fill('input[name="name"]', campaignName);
    await page.fill('textarea[name="description"]', 'Campaign for creative upload testing');
    await page.fill('input[name="budget_total"]', '5000');
    await page.fill('input[name="start_date"]', startDate);
    await page.fill('input[name="end_date"]', endDate);
    await page.fill('input[name="cpm_rate"]', '5.00');
    await page.click('button:has-text("Create Campaign")');
    await page.waitForURL('**/campaigns', { timeout: 10000 });

    // Extract campaign ID from the campaigns list
    await page.waitForTimeout(1000);

    // Find the row containing the campaign name, then get the "View Details" link
    const campaignRow = page.locator('tr').filter({ hasText: campaignName });
    const viewDetailsLink = campaignRow.locator('a:has-text("View Details")');
    const href = await viewDetailsLink.getAttribute('href');
    campaignId = href?.split('/').pop() || '';
    console.log(`✅ Created test campaign: ${campaignId}`);
  });

  test('should navigate to creative upload form', async ({ page }) => {
    console.log('🔍 Testing: Navigate to creative upload form...');

    // Navigate to campaign details
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}`);
    console.log('✅ On campaign details page');

    // Click "Upload Creative" button
    await page.click('text=Upload Creative');
    await page.waitForURL(`**/campaigns/${campaignId}/creatives/new`, { timeout: 5000 });
    console.log('✅ Navigated to creative upload form');

    expect(page.url()).toContain(`/campaigns/${campaignId}/creatives/new`);

    // Check form elements are visible
    await expect(page.locator('h1:has-text("Upload Creative")')).toBeVisible();
    await expect(page.locator('text=Drop your video file here')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
    console.log('✅ All form elements visible');
  });

  test('should disable submit button when no file selected', async ({ page }) => {
    console.log('🔍 Testing: Button disabled without file...');

    // Navigate to upload form
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}/creatives/new`);
    console.log('✅ On creative upload form');

    // Check that submit button is disabled when no file is selected
    const submitButton = page.locator('button:has-text("Upload Creative")');
    await expect(submitButton).toBeDisabled();
    console.log('✅ Submit button is disabled without file');

    // Should still be on upload page
    expect(page.url()).toContain(`/campaigns/${campaignId}/creatives/new`);
  });

  test('should disable submit button when name is empty', async ({ page }) => {
    console.log('🔍 Testing: Button disabled without name...');

    // Navigate to upload form
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}/creatives/new`);
    console.log('✅ On creative upload form');

    // Create a fake video file using the file input
    const fileContent = Buffer.from('fake video content');
    const testFile = {
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: fileContent,
    };

    // Attach file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });
    console.log('✅ File attached');

    // Clear the name field (it auto-fills from filename)
    await page.fill('input#name', '');
    console.log('✅ Cleared name field');

    // Wait for React to update
    await page.waitForTimeout(100);

    // Check that submit button is disabled
    const submitButton = page.locator('button:has-text("Upload Creative")');
    await expect(submitButton).toBeDisabled();
    console.log('✅ Submit button is disabled without name');

    // Should still be on upload page
    expect(page.url()).toContain(`/campaigns/${campaignId}/creatives/new`);
  });

  test('should auto-fill name from filename', async ({ page }) => {
    console.log('🔍 Testing: Auto-fill name from filename...');

    // Navigate to upload form
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}/creatives/new`);
    console.log('✅ On creative upload form');

    // Create a fake video file
    const fileContent = Buffer.from('fake video content');
    const testFile = {
      name: 'my-awesome-video.mp4',
      mimeType: 'video/mp4',
      buffer: fileContent,
    };

    // Attach file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });
    console.log('✅ File attached');

    // Wait for name to be auto-filled
    await page.waitForTimeout(500);

    // Check that name field contains filename without extension
    const nameValue = await page.locator('input#name').inputValue();
    expect(nameValue).toBe('my-awesome-video');
    console.log('✅ Name auto-filled from filename');
  });

  test('should allow removing selected file', async ({ page }) => {
    console.log('🔍 Testing: Remove selected file...');

    // Navigate to upload form
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}/creatives/new`);
    console.log('✅ On creative upload form');

    // Create a fake video file
    const fileContent = Buffer.from('fake video content');
    const testFile = {
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: fileContent,
    };

    // Attach file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: testFile.name,
      mimeType: testFile.mimeType,
      buffer: testFile.buffer,
    });
    console.log('✅ File attached');

    // Wait for file to be displayed
    await page.waitForTimeout(500);
    await expect(page.locator('text=test-video.mp4')).toBeVisible();
    console.log('✅ File displayed');

    // Click remove button (X button)
    await page.click('button[aria-label="Remove file"]');
    console.log('🔘 Clicked remove button');

    // Wait for file to be removed
    await page.waitForTimeout(500);

    // Should show upload area again
    await expect(page.locator('text=Drop your video file here')).toBeVisible();
    console.log('✅ File removed, upload area visible again');
  });

  test('should cancel upload and return to campaign details', async ({ page }) => {
    console.log('🔍 Testing: Cancel upload...');

    // Navigate to upload form
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}/creatives/new`);
    console.log('✅ On creative upload form');

    // Click cancel
    await page.click('text=Cancel');
    console.log('🔘 Clicked cancel');

    // Should redirect to campaign details
    await page.waitForURL(`**/campaigns/${campaignId}`, { timeout: 5000 });
    console.log('✅ Redirected to campaign details');

    expect(page.url()).toContain(`/campaigns/${campaignId}`);
    expect(page.url()).not.toContain('/creatives/new');
  });

  test('should navigate back to campaigns list from campaign details', async ({ page }) => {
    console.log('🔍 Testing: Back to campaigns navigation...');

    // Navigate to campaign details
    await page.goto(`${DASHBOARD_URL}/campaigns/${campaignId}`);
    console.log('✅ On campaign details page');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Click "Back to Campaigns" link
    await page.click('text=Back to Campaigns');
    console.log('🔘 Clicked Back to Campaigns');

    // Should redirect to campaigns list
    await page.waitForURL('**/campaigns', { timeout: 5000 });
    console.log('✅ Redirected to campaigns list');

    expect(page.url()).toContain('/campaigns');
    expect(page.url()).not.toContain(`/${campaignId}`);

    // Should not show 404 error
    const has404 = await page.locator('text=/404|not found/i').isVisible();
    expect(has404).toBeFalsy();
    console.log('✅ No 404 error displayed');

    // Should see campaigns page elements
    await expect(page.locator('main h1:has-text("Campaigns")')).toBeVisible();
    console.log('✅ Campaigns page loaded successfully');
  });
});
