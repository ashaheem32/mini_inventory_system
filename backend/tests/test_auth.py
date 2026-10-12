import pytest
from rest_framework.authtoken.models import Token

from .conftest import PASSWORD

LOGIN = "/api/auth/login/"
ME = "/api/auth/me/"
LOGOUT = "/api/auth/logout/"
GENERIC = "Unable to log in with the provided credentials."


@pytest.mark.django_db
class TestLogin:
    def test_valid_login_returns_token_and_user(self, api_client, user):
        res = api_client.post(LOGIN, {"username": "alice", "password": PASSWORD}, format="json")
        assert res.status_code == 200
        assert res.json() == {
            "token": Token.objects.get(user=user).key,
            "user": {"id": user.id, "username": "alice"},
        }

    def test_repeat_login_reuses_token(self, api_client, user):
        body = {"username": "alice", "password": PASSWORD}
        first = api_client.post(LOGIN, body, format="json").json()["token"]
        second = api_client.post(LOGIN, body, format="json").json()["token"]
        assert first == second

    def test_wrong_password_is_generic_400(self, api_client, user):
        res = api_client.post(LOGIN, {"username": "alice", "password": "wrong"}, format="json")
        assert res.status_code == 400
        assert res.json() == {"non_field_errors": [GENERIC]}

    def test_unknown_user_gets_same_message(self, api_client, db):
        res = api_client.post(LOGIN, {"username": "ghost", "password": "x"}, format="json")
        assert res.status_code == 400
        assert res.json() == {"non_field_errors": [GENERIC]}

    def test_inactive_user_cannot_log_in(self, api_client, user):
        user.is_active = False
        user.save()
        res = api_client.post(LOGIN, {"username": "alice", "password": PASSWORD}, format="json")
        assert res.status_code == 400
        assert res.json() == {"non_field_errors": [GENERIC]}

    def test_missing_fields_return_field_errors(self, api_client, db):
        res = api_client.post(LOGIN, {}, format="json")
        assert res.status_code == 400
        assert set(res.json()) == {"username", "password"}

    def test_login_ignores_stale_token_header(self, api_client, user):
        api_client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        res = api_client.post(LOGIN, {"username": "alice", "password": PASSWORD}, format="json")
        assert res.status_code == 200

    def test_login_is_throttled(self, api_client, user):
        body = {"username": "alice", "password": "wrong"}
        codes = [api_client.post(LOGIN, body, format="json").status_code for _ in range(11)]
        assert codes[:10] == [400] * 10
        assert codes[10] == 429


@pytest.mark.django_db
class TestUnauthorized:
    @pytest.mark.parametrize(
        "method,url",
        [
            ("get", ME),
            ("post", LOGOUT),
            ("get", "/api/categories/"),
            ("get", "/api/products/"),
            ("post", "/api/products/"),
            ("get", "/api/products/1/"),
            ("put", "/api/products/1/"),
            ("patch", "/api/products/1/"),
            ("delete", "/api/products/1/"),
        ],
    )
    def test_requires_token(self, api_client, method, url):
        res = getattr(api_client, method)(url)
        assert res.status_code == 401
        assert res["WWW-Authenticate"] == "Token"

    def test_invalid_token_rejected(self, api_client):
        api_client.credentials(HTTP_AUTHORIZATION="Token bogus")
        assert api_client.get(ME).status_code == 401


@pytest.mark.django_db
class TestMeAndLogout:
    def test_me_returns_current_user(self, auth_client, user):
        res = auth_client.get(ME)
        assert res.status_code == 200
        assert res.json() == {"id": user.id, "username": "alice"}

    def test_logout_revokes_token(self, auth_client, token, user):
        res = auth_client.post(LOGOUT)
        assert res.status_code == 204
        assert not Token.objects.filter(user=user).exists()
        assert auth_client.get(ME).status_code == 401
        assert auth_client.get("/api/products/").status_code == 401

    def test_login_after_logout_issues_new_token(self, auth_client, token, api_client):
        auth_client.post(LOGOUT)
        res = api_client.post(LOGIN, {"username": "alice", "password": PASSWORD}, format="json")
        assert res.status_code == 200
        assert res.json()["token"] != token.key
