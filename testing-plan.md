# TransitOps — QA Test Plan (Role-Wise)
### Companion to project.md — mapped against the 9-screen UI mockup

> Covers: Authentication/RBAC, Dashboard, Vehicle Registry, Drivers & Safety Profiles, Trip Dispatcher, Maintenance, Fuel & Expense Management, Reports & Analytics, Settings & RBAC.

---

## 1. Scope & Naming Note

The mockup uses **"Dispatcher"** as the operational role (creates/dispatches trips), where `project.md` currently names this role **"Driver."** This test plan uses **Dispatcher** to match the UI, since that's the label users will actually see. Before test execution, confirm with the team which name is final and update the Prisma `Role` enum + this document to match — don't ship a mismatch between schema and screen.

Four roles under test: **Fleet Manager, Dispatcher, Safety Officer, Financial Analyst.**

---

## 2. Role Access Matrix (from Settings & RBAC screen)

| Module | Fleet Manager | Dispatcher | Safety Officer | Financial Analyst |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Fleet (Vehicle Registry) | ✓ Full | View only | — | View only |
| Drivers | View only | — | ✓ Full | View only |
| Trips (Dispatcher) | — | ✓ Full | View only | — |
| Maintenance | ✓ Full | — | — | View only |
| Fuel & Expenses | — | Log fuel only | — | ✓ Full |
| Analytics / Reports | ✓ | — | View only | ✓ Full |
| Settings & RBAC | ✓ (owner) | — | — | — |

**Test priority rule:** every cell above needs both a **positive test** (role can do what's allowed) and a **negative test** (role is blocked/read-only/hidden from what's not allowed). A role seeing a module it shouldn't, or an action button rendering when it should be disabled/hidden, is a P0 defect regardless of whether the underlying API is protected.

---

## 3. Test Environment Setup (Preconditions for all suites)

- Local Postgres running, seeded via `prisma db seed` with at least:
  - 4 user accounts, one per role
  - Vehicles covering all 4 statuses (Available, On Trip, In Shop, Retired)
  - Drivers covering all 4 statuses (Available, On Trip, Off Duty, Suspended), including one with an **expired** license and one expiring within 30 days
  - At least 2 completed trips, 1 dispatched trip, 1 draft trip, 1 cancelled trip (to populate Dashboard/Reports)
  - At least 1 open maintenance log and 1 closed one
- Browser: test on Chrome (primary) + 1 secondary browser for cross-browser smoke
- Verify seed data directly in pgAdmin before starting, so failures can be isolated to app logic vs. bad seed data

---

## 4. Test Case Format

`ID | Role | Precondition | Steps | Expected Result | Priority`
Priority: **P0** = blocks core business rule / security, **P1** = functional but non-blocking, **P2** = cosmetic/UX.

---

## 5. Module 0 — Authentication & RBAC (All Roles)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| AUTH-01 | Any | Enter valid email + password for each of the 4 roles, submit | Login succeeds, redirected to Dashboard, correct role shown in top-right badge (e.g. "Dispatcher") | P0 |
| AUTH-02 | Any | Enter valid email, wrong password | "Invalid credentials" error shown, no redirect, attempt counter increments | P0 |
| AUTH-03 | Any | Enter wrong password 5 times in a row | Account locked; message: **"Invalid credentials. Account locked after 5 failed attempts"**; further correct-password attempts still rejected until unlock/reset | P0 |
| AUTH-04 | Any | Submit login with empty email or password | Inline validation error, no network call fired | P1 |
| AUTH-05 | Any | Log in, refresh the page | Session persists (JWT/cookie), user stays logged in, not bounced to login | P1 |
| AUTH-06 | Any | Log in, manually navigate to a route outside the role's allowed sidebar items (e.g. Dispatcher → `/settings`) | Blocked with a 403 page or redirect — **not** a silently empty page | P0 |
| AUTH-07 | Any | Check "Remember me", log in, close and reopen browser | Session still valid per remember-me duration | P2 |
| AUTH-08 | Any | Log out | Redirected to login, protected routes no longer accessible via back-button or direct URL | P0 |
| AUTH-09 | Any | Call a protected API route directly (e.g. via curl/Postman) with no token | 401 Unauthorized | P0 |
| AUTH-10 | Any | Call a protected API route with a valid token for the wrong role (e.g. Dispatcher token hitting `/api/drivers` suspend) | 403 Forbidden — confirms server-side RBAC, not just UI hiding | P0 |

---

## 6. Module 1 — Dashboard (All Roles)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| DASH-01 | All | Load Dashboard after login | KPI cards render: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips, Pending Trips, Drivers on Duty, Fleet Utilization % | P0 |
| DASH-02 | All | Compare KPI numbers against seeded DB data (via pgAdmin query) | Counts match exactly (e.g. Available Vehicles = count of `status=AVAILABLE AND isActive=true`) | P0 |
| DASH-03 | All | Apply Vehicle Type filter | KPI cards and Recent Trips update to reflect only that type | P1 |
| DASH-04 | All | Apply Status filter | Data scoped correctly; combining Status + Region filters narrows further (AND logic, not OR) | P1 |
| DASH-05 | All | Apply Region filter, select a region with zero vehicles | Empty-state shown gracefully (not a blank crash or "NaN%") | P1 |
| DASH-06 | All | Inspect Recent Trips table | Shows trip #, vehicle, driver, status badge (color-coded), ETA; a Draft trip with no vehicle/driver assigned shows "—" / "Awaiting Vehicle" rather than blank cells | P1 |
| DASH-07 | All | Inspect Vehicle Status bar chart | Segments (Available/On Trip/In Shop/Retired) sum to 100% of active fleet and match table counts | P1 |
| DASH-08 | Fleet Manager | Confirm "+ Add Vehicle" or fleet shortcut is reachable from dashboard nav | Navigates correctly, no permission error | P2 |
| DASH-09 | Financial Analyst | Confirm Dashboard is read-only (no create/edit actions available anywhere on this screen) | No writable controls rendered | P1 |
| DASH-10 | All | Trigger a status change elsewhere (e.g. dispatch a trip in another tab), return to Dashboard | Live/refreshed KPIs reflect the change (either via refetch-on-focus or manual refresh — confirm which is implemented and that it's not stale indefinitely) | P1 |

---

## 7. Module 2 — Vehicle Registry (Fleet Manager primary; others view/deny)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| VEH-01 | Fleet Manager | Click "+ Add Vehicle", fill valid data (unique reg. no, type, capacity, odometer, acquisition cost, region), Save | Vehicle created with status=Available, appears in table immediately | P0 |
| VEH-02 | Fleet Manager | Attempt to add a vehicle with a registration number that already exists | Rejected with a clear "Registration number must be unique" error; no duplicate row created | P0 |
| VEH-03 | Fleet Manager | Edit an existing vehicle's non-status fields (name, capacity, region) | Changes persist, table reflects update | P1 |
| VEH-04 | Fleet Manager | Attempt to manually set a `Retired` vehicle's status back to `Available` via edit | Blocked — retirement is terminal (business rule #4) | P0 |
| VEH-05 | Fleet Manager | Retire an `Available` vehicle | Status → Retired; vehicle is **not hard-deleted** (still visible in registry with Retired badge, `isActive` logic preserved per soft-delete rule) | P0 |
| VEH-06 | Fleet Manager | Use Type / Status / Search filters on the registry table | Table filters correctly and combinably | P1 |
| VEH-07 | Dispatcher | Open Vehicle Registry (if reachable) | Read-only: no "+ Add Vehicle" button, no inline edit controls | P0 |
| VEH-08 | Financial Analyst | Open Vehicle Registry | Read-only, same as above; can view acquisition cost (needed for ROI context) | P1 |
| VEH-09 | Safety Officer | Attempt to reach Vehicle Registry via sidebar or direct URL | Module hidden from nav; direct URL blocked (403) per matrix | P0 |
| VEH-10 | Fleet Manager | Confirm the on-screen rule banner text is accurate | Banner reads "Registration no. must be unique; Retired/In Shop vehicles are hidden from Trip Dispatcher" and both behaviors verified true (cross-check against VEH-02 and TRIP-04) | P2 |

---

## 8. Module 3 — Drivers & Safety Profiles (Safety Officer primary)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| DRV-01 | Safety Officer | Click "+ Add Driver", fill valid data (name, license no [unique], category, expiry date, contact, optional email/address), Save | Driver created with status=Available | P0 |
| DRV-02 | Safety Officer | Add a driver with a license number that already exists | Rejected — license number must be unique | P0 |
| DRV-03 | Safety Officer | Add/edit a driver with `licenseExpiryDate` in the past | Row shows "EXPIRED" badge/label next to the date (as in mockup: "03/2025 EXPIRED") | P0 |
| DRV-04 | Safety Officer | Suspend an `Available` driver | Status → Suspended; driver immediately excluded from `/drivers/available` (verify in Trip Dispatcher, TRIP-05) | P0 |
| DRV-05 | Safety Officer | Edit a driver's Safety Score | Value updates and persists; visible on both this screen and Reports if surfaced there | P1 |
| DRV-06 | Safety Officer | Check "Toggle Status" quick actions (Available / On Trip / Off Duty / Suspended shown as chips in mockup) | Each toggle updates status correctly and updates downstream eligibility (esp. Off Duty → blocked from dispatch, rule #8) | P0 |
| DRV-07 | Fleet Manager | Open Drivers screen | Read-only: can view but not add/edit/suspend | P1 |
| DRV-08 | Financial Analyst | Open Drivers screen | Read-only, same as above | P1 |
| DRV-09 | Dispatcher | Attempt to reach Drivers & Safety Profiles module | Hidden from nav; direct URL blocked (403) per matrix | P0 |
| DRV-10 | Safety Officer | Confirm rule banner accuracy: "Expired license or Suspended status → blocked from trip assignment" | Cross-check against TRIP-04/TRIP-05 — both conditions actually block dispatch | P1 |

---

## 9. Module 4 — Trip Dispatcher (Dispatcher primary; Fleet Manager/Safety Officer view)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TRIP-01 | Dispatcher | Click "Create Trip", fill source, destination, select vehicle (Available-only dropdown), select driver (Available-only dropdown), cargo weight ≤ capacity, planned distance, Save | Trip created as **Draft**, appears on Live Board with "Awaiting driver/vehicle" if incomplete, else ready to dispatch | P0 |
| TRIP-02 | Dispatcher | Set source and destination to the **same** location | Blocked — "Source and destination cannot be the same" (rule #11) | P0 |
| TRIP-03 | Dispatcher | Set cargo weight **greater than** the selected vehicle's max capacity (e.g. 700kg on a 500kg van) | Blocked with the exact mockup message pattern: **"Vehicle Capacity 500 kg / Cargo Weight 700 kg / ✗ Capacity exceeded by 200 kg → dispatch blocked"**; Dispatch button disabled | P0 |
| TRIP-04 | Dispatcher | Open the vehicle dropdown | Only vehicles with status=Available appear; confirm a Retired or In Shop vehicle from seed data is **absent** | P0 |
| TRIP-05 | Dispatcher | Open the driver dropdown | Only drivers with status=Available appear; confirm a Suspended driver and an expired-license driver from seed data are **absent** | P0 |
| TRIP-06 | Dispatcher | Set cargo weight to 0 or a negative number | Blocked — cargo weight must be > 0 (rule #10) | P1 |
| TRIP-07 | Dispatcher | Click "Dispatch (Unbooked)" on a valid Draft trip | Trip moves Draft → Dispatched on the lifecycle tracker; vehicle and driver both flip to On Trip; both disappear from other trips' Available dropdowns immediately | P0 |
| TRIP-08 | Dispatcher | Attempt to dispatch a trip whose driver has just been suspended by a Safety Officer (race condition) mid-flow | Blocked at dispatch time even if selected earlier — re-validate eligibility server-side at the dispatch action, not just at trip creation | P0 |
| TRIP-09 | Dispatcher | Complete a Dispatched trip: enter final odometer + fuel consumed | Trip → Completed; vehicle and driver both revert to Available; per mockup note "On Complete: odometer → fuel log → expenses → Vehicle & Driver Available" — confirm a fuel log entry is actually created, not just implied | P0 |
| TRIP-10 | Dispatcher | Attempt to complete a trip that is still in **Draft** status (skip dispatch) | Blocked — only Dispatched trips can be completed (rule #13) | P0 |
| TRIP-11 | Dispatcher | Cancel a Dispatched trip | Trip → Cancelled; vehicle and driver both revert to Available | P0 |
| TRIP-12 | Dispatcher | Cancel a Draft trip (nothing dispatched yet) | Trip → Cancelled with no vehicle/driver status side-effects (nothing was reserved) | P1 |
| TRIP-13 | Dispatcher | Attempt to move a Cancelled trip to Completed (e.g. via replay/retry action or direct API call) | Blocked — Cancelled is terminal, cannot become Completed (rule #15) | P0 |
| TRIP-14 | Fleet Manager | Open Trip Dispatcher | Read-only per matrix (view trips, no create/dispatch/complete/cancel controls) | P1 |
| TRIP-15 | Safety Officer | Open Trip Dispatcher | View-only, same as above | P1 |
| TRIP-16 | Financial Analyst | Attempt to reach Trip Dispatcher | Hidden from nav; direct URL blocked (403) per matrix | P0 |
| TRIP-17 | Dispatcher | Confirm each trip shown gets a unique, sequential-looking Trip Number (TRP-0001 etc.) | Numbers are unique and generated server-side, no collisions under rapid creation | P1 |

---

## 10. Module 5 — Maintenance (Fleet Manager primary)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| MAINT-01 | Fleet Manager | Select an **Available** vehicle, log a service record (service type, cost, date), Save | Maintenance log created (isActive=true); vehicle status auto-flips to **In Shop**; confirm it now disappears from Trip Dispatcher's vehicle dropdown | P0 |
| MAINT-02 | Fleet Manager | Attempt to log a maintenance record against a vehicle currently **On Trip** | Blocked — "vehicle cannot enter maintenance while On Trip" (rule #3) | P0 |
| MAINT-03 | Fleet Manager | Attempt to open a second active maintenance log on a vehicle that already has one open | Blocked — no two simultaneously open logs per vehicle (rule #20) | P0 |
| MAINT-04 | Fleet Manager | Enter a negative cost value | Blocked — cost must be ≥ 0 (rule #21) | P1 |
| MAINT-05 | Fleet Manager | Close an open maintenance log on a non-retired vehicle | Log status → closed (isActive=false); vehicle reverts to **Available** | P0 |
| MAINT-06 | Fleet Manager | Close an open maintenance log on a vehicle that was separately marked **Retired** during the maintenance window | Vehicle does **not** revert to Available — stays Retired (rule #19 exception) | P0 |
| MAINT-07 | Fleet Manager | Review the Service Log table | Shows vehicle, service type, cost, status per row, matches created/closed records exactly | P1 |
| MAINT-08 | Financial Analyst | Open Maintenance module | Read-only (view costs for Reports context, no log/close controls) | P1 |
| MAINT-09 | Dispatcher / Safety Officer | Attempt to reach Maintenance module | Hidden from nav; direct URL blocked (403) per matrix | P0 |
| MAINT-10 | Fleet Manager | Confirm on-screen rule banner: "Auto: In Shop vehicles are removed from the dispatch pool" | Cross-check against TRIP-04 — true in practice | P2 |

---

## 11. Module 6 — Fuel & Expense Management (Financial Analyst primary; Dispatcher can log fuel)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FUEL-01 | Financial Analyst | Click "+ Log Fuel", select vehicle (optionally link a trip), enter liters + cost + date, Save | Fuel log created, appears in Fuel Logs table | P0 |
| FUEL-02 | Financial Analyst | Enter negative liters or negative cost | Blocked — must be ≥ 0 (rule #21) | P1 |
| FUEL-03 | Dispatcher | Log fuel for a trip they just completed | Allowed per matrix ("Log fuel only"); confirm Dispatcher cannot also log a generic Expense (Toll/Other) if that's restricted to Financial Analyst — verify against final matrix | P1 |
| FUEL-04 | Financial Analyst | Click "+ Add Expense", select type (Toll / Maintenance / Other via `ExpenseType` enum), amount, Save | Expense created and categorized correctly, no free-text type field accepted | P0 |
| FUEL-05 | Financial Analyst | Enter a negative expense amount | Blocked — amount must be ≥ 0 (rule #21/22) | P1 |
| FUEL-06 | Financial Analyst | Review "Other Expenses (Toll/Misc)" table with Total Operational Cost row | Confirm formula: **Total Operational Cost = Fuel + Maintenance** (+ other expenses if included) matches manual sum from pgAdmin | P0 |
| FUEL-07 | Financial Analyst | Filter/search fuel logs by vehicle | Table scopes correctly | P2 |
| FUEL-08 | Fleet Manager / Safety Officer | Attempt to reach Fuel & Expense Management | Hidden from nav; direct URL blocked (403) per matrix (Fleet Manager shows "—" for this module) | P0 |

---

## 12. Module 7 — Reports & Analytics (Financial Analyst / Fleet Manager)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| REP-01 | Financial Analyst | Load Analytics screen | KPI tiles render: Fuel Efficiency (km/l), Fleet Utilization %, Operational Cost, Vehicle ROI % | P0 |
| REP-02 | Financial Analyst | Manually recompute Fuel Efficiency for one vehicle from raw trip/fuel data (actualDistance / fuelConsumed) | Matches displayed value | P0 |
| REP-03 | Financial Analyst | Manually recompute Vehicle ROI: (Revenue − (Maintenance + Fuel)) / Acquisition Cost | Matches displayed value exactly, including sign for a loss-making vehicle (negative ROI renders correctly, not as an error) | P0 |
| REP-04 | Financial Analyst | Inspect "Top Costliest Vehicles" bar chart | Ordered descending by operational cost, values match table data | P1 |
| REP-05 | Financial Analyst | Inspect "Monthly Revenue" bar chart | Bars reflect actual `Trip.revenue` sums per month from seed data | P1 |
| REP-06 | Financial Analyst | Apply a date range filter | All four KPI tiles and both charts recompute for the range, not just one | P1 |
| REP-07 | Financial Analyst | Click CSV export | Downloads a CSV with per-vehicle rows for the visible metrics; open file and confirm values match on-screen data | P0 |
| REP-08 | Fleet Manager | Load Analytics screen | Full access per matrix (fleet-level view, may differ from Financial Analyst's cost-centric view — confirm intended scope) | P1 |
| REP-09 | Safety Officer | Load Analytics screen | View-only; confirm which subset is visible (matrix shows "view" — likely safety-relevant metrics only, e.g. no ROI/cost data) | P1 |
| REP-10 | Dispatcher | Attempt to reach Analytics/Reports | Hidden from nav; direct URL blocked (403) per matrix | P0 |
| REP-11 | Any with access | Trigger with zero trips/fuel data for a vehicle (division by zero case for Fuel Efficiency / ROI) | Displays "N/A" or "—" gracefully, not `NaN`, `Infinity`, or a crash | P1 |

---

## 13. Module 8 — Settings & RBAC (Fleet Manager / Admin only)

| ID | Role | Steps | Expected Result | Priority |
|---|---|---|---|---|
| SET-01 | Fleet Manager | Open Settings, edit General fields (Depot name, currency, distance unit) | Fields save and apply elsewhere in the app (e.g. currency symbol updates on Reports/Fuel screens) | P1 |
| SET-02 | Fleet Manager | View the Role-Based Access matrix table | Matches the matrix in Section 2 of this document; any mismatch is a defect against spec, not just cosmetic | P0 |
| SET-03 | Fleet Manager | Click "Save changes" with no edits made | No-op / disabled state, doesn't throw or create empty audit entries | P2 |
| SET-04 | Any non-Fleet-Manager role | Attempt to reach Settings via nav or direct URL | Hidden from nav; direct URL blocked (403) for all three other roles | P0 |
| SET-05 | Fleet Manager | Change distance unit (e.g. km → miles) | Existing stored values either convert on display or the unit change is clearly scoped to new entries — confirm intended behavior with the team before testing this as pass/fail | P2 |

---

## 14. Cross-Role Business Rule Regression Suite

Run this suite **regardless of role UI** — hit the underlying API/service directly where possible to isolate service-layer bugs from UI bugs. This directly mirrors Section 6 of `project.md`.

| ID | Rule | Test | Expected |
|---|---|---|---|
| RULE-01 | Vehicle #1 | Create vehicle with duplicate registrationNo | Rejected (409/400) |
| RULE-02 | Vehicle #2 | Query available-for-dispatch list while a Retired and an In Shop vehicle exist | Neither appears |
| RULE-03 | Vehicle #3 | POST maintenance for a vehicle with status=ON_TRIP | Rejected |
| RULE-04 | Vehicle #4 | PATCH a Retired vehicle's status to Available directly via API | Rejected |
| RULE-05 | Vehicle #5 | DELETE a vehicle (if such an endpoint exists at all) | Should not exist / should be blocked — retire is the only path |
| RULE-06 | Driver #6 | Assign a driver whose licenseExpiryDate < today to a trip | Rejected |
| RULE-07 | Driver #7 | Assign a Suspended driver to a trip | Rejected |
| RULE-08 | Driver #8 | Dispatch a trip with an Off Duty driver | Rejected |
| RULE-09 | Driver #9 | Assign a driver already On Trip to a second trip | Rejected |
| RULE-10 | Trip #10 | Create trip with cargoWeight > vehicle.maxLoadCapacity | Rejected |
| RULE-11 | Trip #11 | Create trip with source == destination | Rejected |
| RULE-12 | Trip #12 | Dispatch a valid Draft trip | Vehicle + Driver → ON_TRIP, both within same transaction |
| RULE-13 | Trip #13 | PATCH complete on a Draft (non-dispatched) trip | Rejected |
| RULE-14 | Trip #14 | Complete a Dispatched trip | Vehicle + Driver → AVAILABLE, same transaction |
| RULE-15 | Trip #15 | PATCH complete on a Cancelled trip | Rejected |
| RULE-16 | Trip #16 | Cancel a Dispatched trip | Vehicle + Driver → AVAILABLE |
| RULE-17 | Trip #17 | Cancel a Draft trip | No vehicle/driver side effects |
| RULE-18 | Maintenance #18 | Open maintenance on an Available vehicle | Vehicle → IN_SHOP |
| RULE-19 | Maintenance #19 | Close maintenance on a non-retired vehicle | Vehicle → AVAILABLE |
| RULE-19b | Maintenance #19 | Close maintenance on a vehicle now marked Retired | Vehicle stays RETIRED |
| RULE-20 | Maintenance #20 | Open a second active maintenance log on a vehicle with one already open | Rejected |
| RULE-21 | Fuel/Expense #21 | POST fuel log / expense / maintenance cost with a negative number | Rejected |
| RULE-22 | Trip #22 | POST/PATCH trip revenue with a negative number | Rejected |

For every "reject" case above, also assert: **no partial side effects occurred** (e.g. a rejected dispatch must leave both vehicle and driver status unchanged — check via a follow-up GET).

---

## 15. Negative & Edge Case Test Bank (from mockup error states)

| ID | Scenario | Expected Behavior |
|---|---|---|
| EDGE-01 | Login with correct email, wrong password 5x | Exact copy: "Invalid credentials. Account locked after 5 failed attempts." Lock persists across page reloads. |
| EDGE-02 | Overweight cargo on trip creation | Exact pattern: "Vehicle Capacity {X} kg / Cargo Weight {Y} kg / ✗ Capacity exceeded by {Y-X} kg → dispatch blocked" with correct arithmetic for arbitrary values, not just the demo numbers | 
| EDGE-03 | Concurrent dispatch: two dispatchers try to dispatch the same Draft trip's vehicle to two different trips within seconds of each other | Only one succeeds; the second gets a clear "vehicle no longer available" error, not a silent double-booking |
| EDGE-04 | Network failure mid-save (simulate by throttling/offline) on any create/edit form | User sees an error toast, form data isn't silently lost, no duplicate record created on retry |
| EDGE-05 | Very large numeric input (e.g. cargoWeight = 999999999) | Either capped/validated with a sane max, or handled without breaking layout/calculations |
| EDGE-06 | Empty states: Dashboard/Reports loaded on a totally fresh DB (no trips/vehicles at all) | All KPIs show 0 / "—" gracefully, charts show empty-state message instead of erroring |
| EDGE-07 | Long strings in text fields (vehicle name, notes, address) | No layout breakage; reasonable max-length enforced with a clear error, not a silent truncation |
| EDGE-08 | Session expiry mid-session (JWT expires while user is mid-form) | On next action, redirected to login with an explanation, not a cryptic 401 in the console only |
| EDGE-09 | Browser back/forward navigation after logout | Cannot view cached protected pages (verify no sensitive data rendered from bfcache) |
| EDGE-10 | Role permission changed by Fleet Manager while a user of that role is actively logged in | Either the session re-validates permissions on next request (recommended, test this) or there's a documented refresh-required behavior — confirm which is intended and test accordingly |

---

## 16. End-to-End Regression Scenario

Run this exact sequence (matches `project.md` Section 12) as a **single pass/fail smoke test** before every release:

1. Fleet Manager registers `Van-05` (region, 500kg capacity, Available).
2. Safety Officer registers driver `Alex` (future license expiry).
3. Dispatcher creates trip `TRP-00001`: distinct source/destination, Van-05, Alex, cargoWeight=450kg, revenue=5000.
4. Confirm creation succeeds (450 ≤ 500).
5. Dispatcher dispatches the trip → Van-05 and Alex both show On Trip everywhere (Dashboard, Vehicle Registry, Drivers screen).
6. Fleet Manager attempts to open maintenance on Van-05 → blocked (still On Trip).
7. Dispatcher completes the trip (odometer + fuel consumed) → both revert to Available.
8. Fleet Manager opens maintenance "Oil Change" (cost=800) on Van-05 → In Shop; Van-05 vanishes from Trip Dispatcher's vehicle dropdown.
9. Dispatcher confirms Van-05 is unselectable for a new trip.
10. Fleet Manager closes maintenance → Van-05 back to Available.
11. Financial Analyst logs a fuel entry (20L, ₹2000) linked to TRP-00001.
12. Financial Analyst checks Reports: fuel efficiency, operational cost, and ROI for Van-05 reflect trip + fuel + maintenance cost correctly.
13. All four roles check Dashboard: KPIs, recent trips, and today's expenses reflect the full sequence.

**Pass criteria:** every step above completes with the exact expected state change and no role sees data/actions outside their matrix access at any point in the sequence.

---

## 17. Bug Report Template

```
Title:
Module:
Role(s) affected:
Test Case ID (if applicable):
Steps to Reproduce:
Expected Result:
Actual Result:
Severity: P0 / P1 / P2
Screenshot/Log:
Environment: (browser, local commit hash)
```

---

## 18. Sign-off Checklist (before demo/submission)

- [ ] All P0 test cases across Sections 5–15 pass
- [ ] RBAC matrix (Section 2) verified against actual Settings screen and actual API 403 behavior — not just UI hiding
- [ ] End-to-End Regression Scenario (Section 16) passes clean in one uninterrupted run
- [ ] No hard-deletes possible anywhere (Vehicle/Driver/User) — only status/isActive transitions
- [ ] All monetary/quantity fields reject negative input at both form and API level
- [ ] CSV export opens correctly and matches on-screen Reports data
- [ ] Fresh-DB empty states don't crash any screen
- [ ] Account lockout after 5 failed logins works and message matches mockup copy
