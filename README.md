# Mini Inventory System

A monorepo for the Mini Inventory assessment.

- `backend/` contains the Django and Django REST Framework API, using SQLite and token authentication.
- `frontend/` contains the React, TypeScript, Vite and TanStack Query client.
- `docs/API_CONTRACT.md` lists endpoints, payloads, errors, demo credentials and startup steps.

## Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_data
python manage.py runserver          # http://127.0.0.1:8000
pytest                              # backend tests
```

## Frontend

Requires Node 20 or newer.

```bash
cd frontend
npm ci
cp .env.example .env.local          # optional; defaults shown in the file
npm run dev                         # http://localhost:5173
npm test                            # component tests (Vitest + Testing Library)
npm run typecheck && npm run lint
npm run build                       # production build in frontend/dist
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | API origin. It must be in the backend `CORS_ALLOWED_ORIGINS`. |
| `VITE_CURRENCY` | `USD` | ISO 4217 code used to display prices. |
| `VITE_LOCALE` | `en-US` | Number formatting locale. It is fixed, so the display does not depend on the viewer's browser. |

Log in with username `demo` and password `demo-pass-2026`. This is a local demo account only.

### Frontend structure

- `src/lib/` holds the API client with token header and 401 handling, the token store, the query client and formatting.
- `src/components/` holds the shared button, alert, toast, skeleton, field, confirmation dialog and layout.
- `src/features/auth/` holds the auth provider and `useAuth`, the login page and the route guards.
- `src/features/products/` holds the list page, table, shared form, add and edit pages, the delete dialog, query hooks and the Zod schema.
- `src/test/` holds an in-memory mock of the API contract and a render helper.

Page, category and search live in the URL. The auth token lives in `sessionStorage`.
