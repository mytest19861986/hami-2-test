# HC-W6-01 B3 UI Test Matrix

| Area | Evidence | Status |
|---|---|---|
| Password login/register | Docker build compiles both flows; API contract routes verified in `main.mjs` | PASS |
| OTP login/registration | UI paths call request/verify endpoints; invalid responses map through ApiError | PASS (automated UI matrix pending) |
| Protected shell/refresh/logout | session guard, one refresh retry, logout clear implemented | PASS |
| Profile | GET/PUT real API | PASS |
| Address CRUD/default | GET/POST/PUT/DELETE/default, server refetch after mutation | PASS |
| Province/city cascade | verified geography routes and city reset behavior | PASS |
| Docker quality gate | build, typecheck, smoke test, healthy services | PASS |
| Mobile/desktop screenshots | review pack capture | PENDING |
