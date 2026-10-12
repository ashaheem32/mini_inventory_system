import os
from decimal import Decimal

os.environ.setdefault("DJANGO_DEBUG", "true")

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from inventory.models import Category, Product

PASSWORD = "s3cret-test-pass"


@pytest.fixture(autouse=True)
def _clear_cache():
    # Login throttle state lives in the cache; isolate tests from each other.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice", password=PASSWORD)


@pytest.fixture
def token(user):
    return Token.objects.create(user=user)


@pytest.fixture
def auth_client(token):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.fixture
def electronics(db):
    return Category.objects.create(name="Electronics")


@pytest.fixture
def kitchen(db):
    return Category.objects.create(name="Kitchen")


@pytest.fixture
def make_product(db, electronics):
    def _make(**overrides):
        data = {
            "name": "Widget",
            "price": Decimal("10.00"),
            "stock": 5,
            "category": electronics,
            "is_active": True,
        }
        data.update(overrides)
        return Product.objects.create(**data)

    return _make
