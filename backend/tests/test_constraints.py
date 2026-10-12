"""Database constraints, exercised without going through serializers."""
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from inventory.models import Category, Product


@pytest.mark.django_db
class TestProductConstraints:
    @pytest.mark.parametrize("price", [Decimal("0"), Decimal("-5.00")])
    def test_price_must_be_positive_on_insert(self, electronics, price):
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.create(name="X", price=price, stock=1, category=electronics)

    def test_price_must_be_positive_on_bulk_update(self, make_product):
        p = make_product()
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=p.pk).update(price=Decimal("0"))

    def test_stock_cannot_be_negative_on_insert(self, electronics):
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.create(name="X", price=Decimal("1"), stock=-1, category=electronics)

    def test_stock_cannot_be_negative_on_bulk_update(self, make_product):
        p = make_product()
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=p.pk).update(stock=-1)

    def test_category_required(self, db):
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.create(name="X", price=Decimal("1"), stock=1, category_id=None)

    def test_category_delete_is_protected(self, make_product, electronics):
        make_product()
        with pytest.raises(ProtectedError):
            electronics.delete()

    def test_category_name_unique(self, electronics):
        with pytest.raises(IntegrityError), transaction.atomic():
            Category.objects.create(name="Electronics")

    def test_defaults(self, make_product):
        p = Product.objects.create(
            name="X", price=Decimal("1"), stock=0, category=make_product().category
        )
        assert p.is_active is True
        assert p.created_at is not None
