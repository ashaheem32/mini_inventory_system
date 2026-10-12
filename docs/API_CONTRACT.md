# Mini Inventory API Contract

Base URL:

- Local development: `http://127.0.0.1:8000`
- Docker Compose: `http://localhost:8080`, where nginx proxies `/api/` to Django on the same origin

All endpoints use JSON and **require the trailing slash** shown below.

## Authentication

Only `POST /api/auth/login/` is public. Every other endpoint requires this header:

```
Authorization: Token <token>
```

A missing, invalid or revoked token returns `401` with a `WWW-Authenticate: Token` header:

```json
{"detail": "Authentication credentials were not provided."}
{"detail": "Invalid token."}
```

Each user has one token. Logging in again returns the same token until logout deletes it.

### POST /api/auth/login/

Request:

```json
{"username": "demo", "password": "demo-pass-2026"}
```

`200 OK`:

```json
{
  "token": "d628add4b12b9aa9ed56e7916fa98b0e34076825",
  "user": {"id": 1, "username": "demo"}
}
```

`400 Bad Request` for a wrong password, unknown user or inactive user. The message is always the same:

```json
{"non_field_errors": ["Unable to log in with the provided credentials."]}
```

`400 Bad Request` for missing fields:

```json
{"username": ["This field is required."], "password": ["This field is required."]}
```

`429 Too Many Requests` after 10 login attempts per minute from one client IP. The rate is set by `LOGIN_THROTTLE_RATE`.

```json
{"detail": "Request was throttled. Expected available in 59 seconds."}
```

A stale `Authorization` header is ignored on this endpoint.

### GET /api/auth/me/

`200 OK`:

```json
{"id": 1, "username": "demo"}
```

### POST /api/auth/logout/

No request body. Deletes the user's token and returns `204 No Content` with an empty body. Later requests with that token return `401`.

## Categories

### GET /api/categories/

Read-only. Categories are managed in the Django admin at `/admin/`. The response is an **unpaginated array** ordered by name:

`200 OK`:

```json
[
  {"id": 4, "name": "Accessories"},
  {"id": 1, "name": "Electronics"},
  {"id": 3, "name": "Kitchen"},
  {"id": 2, "name": "Office Supplies"}
]
```

Other methods return `405`. Category ids depend on the database, so clients should not hard-code them.

## Products

### Product object

```json
{
  "id": 12,
  "name": "Wireless Mouse",
  "price": "49.90",
  "stock": 18,
  "category": 2,
  "category_name": "Electronics",
  "is_active": true,
  "created_at": "2026-10-12T08:44:12.199547Z"
}
```

| Field | Type | Writable | Rules |
|---|---|---|---|
| `id` | integer | no | |
| `name` | string | yes, required | Surrounding whitespace is trimmed. Blank or whitespace-only is rejected. Max 200 characters. |
| `price` | decimal string | yes, required | Greater than 0. At most 2 decimal places and 10 digits in total, so the max is `99999999.99`. A JSON number is also accepted, but responses always use a string. |
| `stock` | integer | yes, required | Whole number from 0 to 2147483647. |
| `category` | integer | yes, required | Id of an existing category. |
| `category_name` | string | no | |
| `is_active` | boolean | yes, optional | Defaults to `true`. |
| `created_at` | ISO 8601 UTC string | no | Set by the server. |

Read-only fields sent in a request are ignored.

### GET /api/products/

Query parameters, all optional and combinable:

| Param | Meaning |
|---|---|
| `page` | 1-based page number. The page size is fixed at 10. |
| `category` | Category id. An unknown id returns an empty result. A non-numeric value returns `400`. |
| `search` | Case-insensitive substring match on the product **name only**. Words separated by spaces must all appear in the name. |

Inactive products are included. Results are ordered by `created_at` descending, then `id` descending.

Example: `GET /api/products/?page=2&category=2&search=mouse`

`200 OK`:

```json
{
  "count": 24,
  "next": "http://127.0.0.1:8000/api/products/?page=3",
  "previous": "http://127.0.0.1:8000/api/products/",
  "results": [ /* up to 10 product objects */ ]
}
```

`next` and `previous` are absolute URLs that keep the active filters, or `null`. The link to page 1 omits `page=`.

Errors:

- A page past the end, or `page=0`, returns `404 {"detail": "Invalid page."}`. This can happen after the last item on the final page is deleted. Clients should go to the previous page.
- `category=abc` returns `400 {"category": ["Enter a number."]}`.

### POST /api/products/

Request:

```json
{"name": "Wireless Mouse", "price": "49.90", "stock": 18, "category": 2, "is_active": true}
```

`201 Created` returns the product object.

### GET /api/products/{id}/

`200 OK` returns the product object. An unknown id returns `404 {"detail": "No Product matches the given query."}`.

### PUT /api/products/{id}/

Full update. `name`, `price`, `stock` and `category` are required, and `is_active` is optional. `200 OK` returns the updated product.

### PATCH /api/products/{id}/

Partial update. Only the fields supplied are validated and changed.

```json
{"stock": 0}
```

`200 OK` returns the full updated product.

### DELETE /api/products/{id}/

Permanent delete. Returns `204 No Content`, or `404` if the product does not exist.

## Validation errors

Validation failures return `400` in the standard Django REST Framework shape. Each invalid field maps to a list of messages, and every invalid field is reported at once.

```json
{
  "name": ["This field may not be blank."],
  "price": ["Price must be greater than zero."],
  "stock": ["Stock cannot be negative."],
  "category": ["Invalid pk \"999\" - object does not exist."]
}
```

Other messages you may see:

| Field | Message |
|---|---|
| any required | `This field is required.` |
| `name` | `Ensure this field has no more than 200 characters.` |
| `price` | `Ensure that there are no more than 2 decimal places.` |
| `price` | `Ensure that there are no more than 10 digits in total.` |
| `price` | `A valid number is required.` |
| `stock` | `A valid integer is required.` |
| `stock` | `Ensure this value is less than or equal to 2147483647.` |
| `category` | `Incorrect type. Expected pk value, received str.` |
| `category` | `This field may not be null.` |

Malformed JSON returns `400 {"detail": "JSON parse error - ..."}`.

## Status codes

| Code | When |
|---|---|
| 200 | Successful read, update or login |
| 201 | Product created |
| 204 | Product deleted or logged out |
| 400 | Validation error, bad credentials or bad filter value |
| 401 | Missing, invalid or revoked token |
| 404 | Unknown product id or invalid page |
| 405 | Method not allowed |
| 429 | Login throttled |

## CORS

CORS only matters for the local development setup. The Docker build calls the API on its own origin.


Allowed origins come from `CORS_ALLOWED_ORIGINS` and default to `http://localhost:5173,http://127.0.0.1:5173`. The `Authorization` header is allowed. Cookies are not used.

## Demo credentials

Created by `python manage.py seed_data`. This is a disposable local account only.

| Username | Password |
|---|---|
| `demo` | `demo-pass-2026` |

Set `DEMO_PASSWORD` before the first seed to change the password. Re-running the seed never resets an existing password unless `--reset-demo-password` is passed.

## Local startup

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_data
python manage.py runserver        # http://127.0.0.1:8000
pytest                            # run the test suite
```

To use the Django admin, create an admin account with `python manage.py createsuperuser`.
