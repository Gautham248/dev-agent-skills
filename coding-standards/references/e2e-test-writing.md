# E2E Test Writing Guidelines

Generalized guidelines for writing end-to-end tests with Playwright. These conventions are project-agnostic: swap the feature names for your own domain and the same structure applies. Section 10 covers how to adapt the setup for projects that don't have authentication.

---

## 1. Directory Structure

Keep tests out of `src/` in a dedicated `tests/` tree, organized by role rather than by page:

```
tests/
├── global.setup.ts          # Runs once before all tests (e.g. pre-login of test users)
├── fixtures/                # Cross-cutting test infrastructure (auth, seeded data, ...)
│   └── auth/
│       ├── index.ts         # Suite-level setup helpers exported to spec files
│       └── login.ts         # Low-level login action (fills form, submits)
├── lib/
│   ├── types.ts             # Shared TypeScript types (form configs, domain types)
│   ├── helpers.ts           # Reusable setup + navigation + form-fill + assertion helpers
│   └── verify-<domain>.helpers.ts  # Heavy data-verification helpers, one file per domain
└── scenarios/               # One folder per feature area, one spec per flow
    ├── featureA/featureA.spec.ts
    └── featureB/featureB.spec.ts
```

Rules of thumb:

- **Spec files stay thin.** They read like a script of user actions; all mechanics (selectors, form filling, math) live in helpers.
- **One spec file per feature area**, grouped into `test.describe` blocks per scenario.
- **Heavy verification logic gets its own helpers file** so the main `helpers.ts` stays scannable.

---

## 2. Playwright Config Conventions

- `testDir: './tests'`, `fullyParallel: true` locally, `workers: 1` on CI.
- `retries: 2` on CI only; `forbidOnly: !!env.CI` so stray `test.only` fails the build.
- `trace: 'on-first-retry'`.
- `baseURL` comes from an `ORIGIN` env var. The `webServer` block is only defined when `ORIGIN` is **not** set — locally Playwright boots the dev server; on CI/staging the app is assumed to be running already:

```ts
webServer: env.ORIGIN
  ? undefined
  : { command: 'pnpm run dev', url: baseURL, reuseExistingServer: !env.CI }
```

- Load `.env` at the top of the config with `dotenv` + `dotenv-expand`, resolving the path relative to the config file (needed because the config runs as ESM):

```ts
const myEnv = dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenvExpand.expand(myEnv);
```

---

## 3. Selector Strategy: Centralized Test IDs

All structural selectors use `data-testid` attributes through `page.getByTestId(TID.someKey)`, where `TID` is a **single centralized map of every test ID**, shared between app code and tests (imported from the app's constants module so the two can never drift).

- No CSS selectors and no brittle text matching for structural elements. Refactoring the UI only requires updating `TID`.
- Dynamic IDs are functions: `TID.entityRow(name)` returns a test ID with the entity name embedded, so a specific row/card can be targeted.
- User-visible strings used in tests (button labels, titles, messages) also come from a centralized `LABELS` constants object shared with the app — never hardcode display text in a spec.
- **Scope queries to a container** before matching text inside it, instead of searching the whole page:

```ts
const previewCard = page.getByTestId(TID.previewCard);
await expect(previewCard).toBeVisible();
await expect(previewCard.getByText(config.name, { exact: true })).toBeVisible();
```

- Prefer `{ exact: true }` for text matches whenever the string could be a substring of something else.
- Semantic roles are the acceptable secondary selector for interactive elements: `page.getByRole('button', { name: LABELS.confirm })`, `getByRole('menuitem', ...)`, `getByRole('link', ...)`.

---

## 4. Suite-Level Setup Helpers

Each feature area gets **one `setup*TestSuite()` function** that a spec file calls once at the top. It composes everything a suite needs — serial mode, auth (if applicable), and navigation:

```ts
export const setupAuthAndNavigationForFeatureATestSuite = () => {
  test.describe.configure({ mode: 'serial' }); // tests in the suite share state
  setupTestForUser('user1@example.com');       // skip in unauthenticated projects
  test.beforeEach(async ({ page }) => {
    await navigateToFeatureAPage({ page });
  });
};
```

In the spec, call it either outside any `describe` (applies to the whole file) or as the first line inside a `describe` (applies to that suite only):

```ts
setupAuthAndNavigationForFeatureATestSuite(); // ← file-wide

test.describe('Basic operations on feature A', () => { ... });
```

**Why serial mode:** tests within a describe intentionally share one created entity and exercise its lifecycle — "create" → "view" → "copy" → "delete". Later tests operate on what earlier tests created. This keeps suites fast (one expensive creation per suite) at the cost of intra-suite independence; suites themselves stay independent and parallelizable.

Navigation helpers assert they arrived, not just that they clicked:

```ts
export const navigateToFeatureAPage = async ({ page }: { page: Page }) => {
  const navbar = page.getByTestId(TID.navBar);
  await expect(navbar).toBeVisible();
  await navbar.getByText(AppPages.FEATURE_A).nth(0).click();
  await assertPageTitle(page, LABELS.featureATitle, { exact: true });
};
```

---

## 5. Test Data: Generated Configs

- Every creation form has a `generate<Feature>Config()` factory that returns a typed config object.
- **Names embed a CUID** (or other unique suffix) so repeated runs never collide: `` name: `Test Entity ${createCUID()}` ``.
- Factories randomize free parameters (dates, strategies) to broaden coverage across runs, but accept explicit overrides when a suite needs a specific variant:

```ts
const config = generateFeatureConfig(strategies.QUARTERLY); // pinned variant
```

- **Generate the config at `describe` scope, not inside a test**, so all tests in a serial suite reference the same entity:

```ts
test.describe('Basic operations', () => {
  const config: FeatureConfig = generateFeatureConfig(); // once per suite

  test('should be able to create ...', async ({ page }) => { ... });
  test('should be able to delete ...', async ({ page }) => { ... });
});
```

- State captured in one test for use by a later serial test is declared as a `let` at describe scope (e.g. `let tableData: TableData[]`).
- Each config gets its own TypeScript type in `tests/lib/types.ts` so helper signatures are explicit and form changes surface as compile errors.

---

## 6. Helper Conventions

Helpers are grouped by category and named by verb prefix, so their purpose is clear from the call site:

| Category | Naming pattern | Examples |
|---|---|---|
| Suite setup | `setup*TestSuite` | `setupAuthAndNavigationForFeatureATestSuite` |
| Navigation | `navigateTo*` | `navigateToFeatureAPage`, `navigateToSettingsPage` |
| Form fill | `fill*Form` | `fillFeatureACreationForm` |
| Assertions | `assert*` | `assertPageTitle`, `assertComponentsHaveRendered` |
| Data generation | `generate*` | `generateFeatureConfig`, `generateRandomDate` |
| Verification | `verify*` / `validate*` | `verifyROI`, `validateTableMetrics` |
| Utilities | descriptive | `cleanAndParseNumber`, `sleep` |

Signature convention: helpers take a **single destructured object parameter** — `{ page, config }` — never positional arguments. This keeps call sites readable and makes adding parameters non-breaking:

```ts
export const fillFeatureACreationForm = async ({
  page,
  config
}: {
  page: Page;
  config: FeatureConfig;
}) => { ... };
```

---

## 7. Writing the Tests Themselves

- **Test names** are behavior descriptions: `should be able to <do X>` for user-facing flows, `verify <the data/chart/report>` for data-verification tests. Describe blocks name the scenario: `'Basic operations on <feature>'`, `'Data verifications on <feature> with <variant>'`.
- **Assert visibility before interacting.** Every meaningful element is `await expect(locator).toBeVisible()` (or `toBeEnabled()`) before it is clicked or read. This doubles as the wait mechanism — no arbitrary sleeps.
- **Assert absence with `not.toBeVisible()`** after deletions/dismissals, and to confirm loading finished: `await expect(page.getByTestId(TID.progressIndicator)).not.toBeVisible();`
- **Composite render assertions**: after creating an entity, one `assert<Feature>ComponentsHaveRendered` helper checks every major card/table/chart on the result page in one call.
- **Multi-step flows are commented by step** inside the test (`// connect page`, `// create page`, `// confirm modal`) so a failure is easy to locate.
- **Confirmation modals** follow a fixed pattern: assert modal visible → click confirm via test ID → assert the effect.
- **Raise timeouts per-test, not globally**: `test.setTimeout(60000)` at the top of tests that trigger long computations.
- Avoid `waitForTimeout`/`sleep`. The only tolerated uses are documented workarounds in low-level fixtures (e.g. waiting for a session cookie to be written after login), each with a comment explaining why.

---

## 8. Data Verification Pattern

For tests that check calculated values (totals, percentages, charts, exported reports) rather than just presence:

1. **Scrape** raw values from the DOM via test IDs + `.textContent()`, iterating rows of tables with scoped locators.
2. **Parse** defensively: `cleanAndParseNumber` strips currency symbols, commas, and `%` before `Number()` conversion.
3. **Re-derive** the expected values independently, implementing the domain rules in the test helpers (using a precision library like `decimal.js` where the app does).
4. **Compare** with `expect(computed).toBeCloseTo(displayed, 2)` for floats, exact equality otherwise.

Keep this machinery in a dedicated `verify-<domain>.helpers.ts` file with its own domain types (`TableData`, accumulator maps, etc.) so spec files stay declarative.

---

## 9. Authentication (For Apps That Have It)

### Pre-login in global setup

`global.setup.ts` iterates over all test users, logs each in once, and saves browser storage state to `playwright/.auth/<email>.json`. Existing files are reused, so repeated local runs skip login entirely:

```ts
async function globalSetup() {
  for (const user of getTestUsers()) {
    const file = getCredentialFilePath(user.email);
    try {
      await access(file);          // reuse if it exists
    } catch {
      await saveStorageState(user, file); // login + context.storageState({ path })
    }
  }
}
```

### Low-level `login()` action

A single `login(page, email, password?)` function navigates to the login page and fills the form using `TID` selectors. Everything else builds on it — no spec re-implements login.

### Suite-level auth helpers

- `setupTestForUser(email)` — injects the saved storage state via `test.use({ storageState })` for the enclosing scope.
- `setupTestForNvUser(email)` — the primary helper, used when the saved file alone is insufficient. Because `test.use({ storageState })` can't run inside `beforeAll`/`beforeEach`, it logs in once in `beforeAll`, captures the storage state, and in `beforeEach` manually injects cookies + localStorage before navigating.

### Test different authorization tiers

Seed one test user per access level and give each a setup helper (e.g. `setupTestForPremiumUser`, `setUpNonPremiumUser`). Then write **negative-path suites** asserting what a restricted user must *not* see:

```ts
test.describe('Feature access without an active subscription', () => {
  setUpNonPremiumUser();

  test('should show the upsell page instead of the feature', async ({ page }) => {
    await expect(page.getByText(LABELS.upsellTitle)).toBeVisible();
    await expect(page.getByText(LABELS.startFeature, { exact: true })).not.toBeVisible();
  });
});
```

### Keep a login smoke test

One tiny spec that exercises the real login flow end-to-end (the storage-state shortcut bypasses it everywhere else):

```ts
test('Login to dashboard', async ({ page }) => {
  await login(page, 'user1@example.com');
  await expect(page.getByTestId(TID.navBar)).toBeVisible();
});
```

### Housekeeping

- Auth state files live in `playwright/.auth/` — **gitignore this directory**.
- Test users come from a seed script shared with the app (`getTestUsers()`), so tests and seeds can't drift.

---

## 10. Projects Without Authentication

If the app has no login, the structure gets simpler — drop the auth layer and keep everything else identical:

- **No `global.setup.ts`** (or keep it only if you need other one-time setup, e.g. seeding via API). Remove the `globalSetup` key from the config.
- **No `fixtures/auth/`**, no storage-state files, no `playwright/.auth/` directory.
- Suite setup helpers lose the auth line but keep serial mode and navigation:

```ts
export const setupNavigationForFeatureATestSuite = () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');                    // straight to the app
    await navigateToFeatureAPage({ page });
  });
};
```

- Navigation helpers can `page.goto(route)` directly instead of asserting a logged-in nav bar first — but should still end by asserting the destination rendered (`assertPageTitle`).
- Everything else in this document applies unchanged: centralized test IDs and labels, generated configs with unique names, serial lifecycle suites, destructured helper signatures, the data-verification pattern, and the config conventions.
- If authentication is added later, slot in Section 9 without restructuring: add `fixtures/auth/`, a `global.setup.ts`, and prepend the auth call inside the existing `setup*TestSuite` helpers — spec files shouldn't need to change.

---

## 11. Environment / `.env`

- `ORIGIN` — base URL of the app under test. Set it to run against an already-running server (CI/staging); leave unset locally to have Playwright launch the dev server.
- `CI` — standard CI flag; drives headless mode, retries, worker count, and reporter choice.
- Load env vars in the Playwright config only (Section 2); helpers and specs should never read `process.env` directly.

---

## 12. Checklist for a New Spec File

1. Create `tests/scenarios/<feature>/<feature>.spec.ts`.
2. Add any new element selectors to the centralized `TID` map (and visible strings to `LABELS`) — in app code and use them in components.
3. Add a typed `<Feature>Config` to `tests/lib/types.ts` and a `generate<Feature>Config()` factory.
4. Add `fill<Feature>CreationForm`, `navigateTo<Feature>Page`, and `assert<Feature>ComponentsHaveRendered` helpers.
5. Add a `setup*TestSuite()` helper (auth + serial + navigation) and call it at the top of the spec.
6. Write lifecycle tests in order (create → view → mutate → delete) inside one `describe`; data-verification suites in separate `describe` blocks with pinned config variants.
7. If the feature has access tiers, add a negative-path suite for the restricted user.
