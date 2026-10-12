from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from inventory.management.commands.seed_data import DEFAULT_DEMO_PASSWORD, DEMO_USERNAME
from inventory.models import Category, Product


@pytest.fixture(autouse=True)
def _no_demo_password_env(monkeypatch):
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)


def seed(*args):
    call_command("seed_data", *args, stdout=open("/dev/null", "w"))


@pytest.mark.django_db
class TestSeedData:
    def test_creates_expected_data(self):
        seed()
        assert sorted(Category.objects.values_list("name", flat=True)) == [
            "Accessories", "Electronics", "Kitchen", "Office Supplies",
        ]
        assert Product.objects.count() == 24
        for category in Category.objects.all():
            assert category.products.count() == 6
        assert Product.objects.filter(stock=0).exists()
        assert Product.objects.filter(is_active=False).exists()

    def test_creates_demo_user_with_hashed_password(self):
        seed()
        user = get_user_model().objects.get(username=DEMO_USERNAME)
        assert user.check_password(DEFAULT_DEMO_PASSWORD)
        assert user.password.startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt"))
        assert not user.is_staff and not user.is_superuser

    def test_demo_password_from_env(self, monkeypatch):
        monkeypatch.setenv("DEMO_PASSWORD", "from-env-123")
        seed()
        assert get_user_model().objects.get(username=DEMO_USERNAME).check_password("from-env-123")

    def test_repeatable_without_duplicates(self):
        seed()
        seed()
        seed()
        assert Category.objects.count() == 4
        assert Product.objects.count() == 24
        assert get_user_model().objects.filter(username=DEMO_USERNAME).count() == 1

    def test_does_not_overwrite_product_edits(self):
        seed()
        mouse = Product.objects.get(name="Wireless Mouse")
        Product.objects.filter(pk=mouse.pk).update(price=Decimal("1.23"), stock=999, is_active=False)
        seed()
        mouse.refresh_from_db()
        assert (mouse.price, mouse.stock, mouse.is_active) == (Decimal("1.23"), 999, False)

    def test_does_not_reset_existing_password(self):
        seed()
        user = get_user_model().objects.get(username=DEMO_USERNAME)
        user.set_password("changed-by-user")
        user.save()
        seed()
        user.refresh_from_db()
        assert user.check_password("changed-by-user")

    def test_reset_flag_resets_password(self):
        seed()
        user = get_user_model().objects.get(username=DEMO_USERNAME)
        user.set_password("changed-by-user")
        user.save()
        seed("--reset-demo-password")
        user.refresh_from_db()
        assert user.check_password(DEFAULT_DEMO_PASSWORD)

    def test_demo_user_can_log_in(self, api_client):
        seed()
        res = api_client.post(
            "/api/auth/login/",
            {"username": DEMO_USERNAME, "password": DEFAULT_DEMO_PASSWORD},
            format="json",
        )
        assert res.status_code == 200
