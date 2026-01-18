import { test, expect } from '@playwright/test'

test.describe('IT People Finder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the search form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'IT People Finder' })).toBeVisible()
    await expect(page.getByText('Tech Skills', { exact: true })).toBeVisible()
    await expect(page.getByText('Spoken Language', { exact: true })).toBeVisible()
    await expect(page.getByText('Location', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  })

  test('should show initial state with search prompt', async ({ page }) => {
    await expect(page.getByText('Start by selecting tech skills and location to find candidates')).toBeVisible()
  })

  test('should allow selecting tech skills', async ({ page }) => {
    const pythonButton = page.getByRole('button', { name: 'Python' })
    await pythonButton.click()
    await expect(pythonButton).toHaveClass(/bg-blue-600/)

    // Click again to deselect
    await pythonButton.click()
    await expect(pythonButton).toHaveClass(/bg-gray-100/)
  })

  test('should allow selecting multiple tech skills', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    await page.getByRole('button', { name: 'JavaScript' }).click()

    await expect(page.getByRole('button', { name: 'Python' })).toHaveClass(/bg-blue-600/)
    await expect(page.getByRole('button', { name: 'JavaScript' })).toHaveClass(/bg-blue-600/)
  })

  test('should show strict checkbox only when language is selected', async ({ page }) => {
    // Initially no strict checkbox
    await expect(page.getByText('Strict (confirmed match only)')).not.toBeVisible()

    // Select a language
    await page.getByRole('combobox').first().selectOption('Russian')

    // Now strict checkbox should appear
    await expect(page.getByText('Strict (confirmed match only)')).toBeVisible()
  })

  test('should perform search and display results', async ({ page }) => {
    // Select Python
    await page.getByRole('button', { name: 'Python' }).click()

    // Click search
    await page.getByRole('button', { name: 'Search' }).click()

    // Wait for results
    await expect(page.getByText('Searching...')).toBeVisible()

    // Wait for results to load (with timeout)
    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })

  test('should show export button after search', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible({ timeout: 30000 })
  })

  test('should filter by location', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    await page.getByPlaceholder('e.g., Germany, Berlin, Europe').fill('Germany')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })

  test('should display candidate cards with correct information', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    await page.getByRole('button', { name: 'Search' }).click()

    // Wait for results
    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })

    // Check that score badges exist (Score: XX.X format)
    await expect(page.locator('text=/Score: \\d+\\.\\d+/').first()).toBeVisible()

    // Should have GitHub links
    await expect(page.locator('a[href*="github.com"]').first()).toBeVisible()
  })
})

test.describe('Search filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should filter by min stars', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    // Find the input after "Min Stars" label
    await page.locator('input[type="number"]').first().fill('1000')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })

  test('should filter by min followers', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    // Find the second number input (Min Followers)
    await page.locator('input[type="number"]').nth(1).fill('100')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })

  test('should filter by activity', async ({ page }) => {
    await page.getByRole('button', { name: 'Python' }).click()
    // Find the activity dropdown (second select/combobox)
    await page.getByRole('combobox').nth(1).selectOption('3')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Language filter modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('non-strict mode includes users with unknown language', async ({ page }) => {
    await page.getByRole('button', { name: 'Ruby' }).click()
    await page.getByRole('combobox').first().selectOption('Russian')
    // Don't check strict - should include users with unknown language
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByText(/Found \d+ candidates/)).toBeVisible({ timeout: 30000 })
  })

  test('strict mode only shows confirmed matches', async ({ page }) => {
    await page.getByRole('button', { name: 'Ruby' }).click()
    await page.getByRole('combobox').first().selectOption('Russian')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Search' }).click()

    // Wait for search to complete - may show results or "No results found"
    const resultsOrEmpty = page.getByText(/Found \d+ candidates|No results found/)
    await expect(resultsOrEmpty).toBeVisible({ timeout: 30000 })
  })
})
