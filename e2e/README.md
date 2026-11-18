# End-to-end tests

Run against the real Keycloak (`http://localhost:8180`, realm `crm-admin`) and UMS (`http://localhost:8083`) from
`local-docker`. Playwright starts `npm run dev` on port 5175 unless `E2E_BASE_URL` is set.

```bash
npx playwright install chromium
E2E_ADMIN_USERNAME=... E2E_ADMIN_PASSWORD=... npm run e2e
```

| Variable                                      | Used by             | Needs                                                                                                                 |
| --------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD`   | all specs           | a `crm-admin` user with realm role `admin` and **no pending required actions** (no TOTP setup)                        |
| `E2E_ADMIN2_USERNAME` / `E2E_ADMIN2_PASSWORD` | grant approval spec | a second such admin                                                                                                   |
| `E2E_ACTIVE_USER_EMAIL`                       | users spec          | an ACTIVE internal user to disable and enable again (new users start INVITED, and the UMS disables only ACTIVE users) |
| `E2E_CORPORATE_DOMAIN`                        | users spec          | a domain in the UMS `UMS_CORPORATE_DOMAINS` (default `crm.local`)                                                     |
| `E2E_SUPER_MANAGER_TARGET_EMAIL`              | grant approval spec | an ACTIVE internal user without `super-manager`                                                                       |

The realm's `admin.local` has a `CONFIGURE_TOTP` required action, so it can't sign in unattended. A test-only admin
without required actions (or with a known TOTP secret the tests can compute codes from) must be added to the
`crm-admin` realm import in `local-docker`. Specs skip when the variables are missing.
