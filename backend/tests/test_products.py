from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from inventory.models import Category, Product

LIST = "/api/products/"


def detail(pk):
    return f"/api/products/{pk}/"


@pytest.mark.django_db
class TestCrud:
    def test_create(self, auth_client, electronics):
        payload = {"name": "Wireless Mouse", "price": "49.90", "stock": 18, "category": electronics.id}
        res = auth_client.post(LIST, payload, format="json")
        assert res.status_code == 201
        body = res.json()
        product = Product.objects.get(pk=body["id"])
        assert body == {
            "id": product.id,
            "name": "Wireless Mouse",
            "price": "49.90",
            "stock": 18,
            "category": electronics.id,
            "category_name": "Electronics",
            "is_active": True,
            "created_at": body["created_at"],
        }
        assert parse_datetime(body["created_at"]) == product.created_at
        assert product.price == Decimal("49.90")

    def test_create_ignores_read_only_fields(self, auth_client, electronics):
        payload = {
            "id": 999,
            "name": "Mouse",
            "price": "1.00",
            "stock": 1,
            "category": electronics.id,
            "category_name": "Hacked",
            "created_at": "2000-01-01T00:00:00Z",
        }
        body = auth_client.post(LIST, payload, format="json").json()
        assert body["id"] != 999
        assert body["category_name"] == "Electronics"
        assert not body["created_at"].startswith("2000")

    def test_retrieve(self, auth_client, make_product):
        p = make_product(name="Kettle", price=Decimal("119.00"))
        res = auth_client.get(detail(p.id))
        assert res.status_code == 200
        assert res.json()["name"] == "Kettle"
        assert res.json()["price"] == "119.00"

    def test_retrieve_missing_is_404(self, auth_client, db):
        assert auth_client.get(detail(9999)).status_code == 404

    def test_full_update(self, auth_client, make_product, kitchen):
        p = make_product()
        payload = {"name": "Mug", "price": "24.00", "stock": 40, "category": kitchen.id, "is_active": False}
        res = auth_client.put(detail(p.id), payload, format="json")
        assert res.status_code == 200
        p.refresh_from_db()
        assert (p.name, p.price, p.stock, p.category_id, p.is_active) == (
            "Mug", Decimal("24.00"), 40, kitchen.id, False,
        )
        assert res.json()["category_name"] == "Kitchen"

    def test_put_requires_all_required_fields(self, auth_client, make_product):
        p = make_product()
        res = auth_client.put(detail(p.id), {"name": "Only name"}, format="json")
        assert res.status_code == 400
        assert set(res.json()) == {"price", "stock", "category"}

    def test_delete_is_permanent(self, auth_client, make_product):
        p = make_product()
        assert auth_client.delete(detail(p.id)).status_code == 204
        assert not Product.objects.filter(pk=p.id).exists()
        assert auth_client.get(detail(p.id)).status_code == 404


@pytest.mark.django_db
class TestPartialUpdate:
    def test_patch_single_field_keeps_others(self, auth_client, make_product):
        p = make_product(name="Pen", price=Decimal("2.50"), stock=10)
        res = auth_client.patch(detail(p.id), {"stock": 0}, format="json")
        assert res.status_code == 200
        p.refresh_from_db()
        assert (p.name, p.price, p.stock) == ("Pen", Decimal("2.50"), 0)

    def test_patch_is_active(self, auth_client, make_product):
        p = make_product()
        res = auth_client.patch(detail(p.id), {"is_active": False}, format="json")
        assert res.status_code == 200
        assert res.json()["is_active"] is False

    def test_patch_validates_supplied_fields(self, auth_client, make_product):
        p = make_product()
        res = auth_client.patch(detail(p.id), {"price": "-1"}, format="json")
        assert res.status_code == 400
        assert set(res.json()) == {"price"}
        p.refresh_from_db()
        assert p.price == Decimal("10.00")

    def test_patch_trims_name(self, auth_client, make_product):
        p = make_product()
        res = auth_client.patch(detail(p.id), {"name": "  Padded  "}, format="json")
        assert res.json()["name"] == "Padded"

    def test_patch_read_only_fields_ignored(self, auth_client, make_product):
        p = make_product()
        original = p.created_at
        auth_client.patch(detail(p.id), {"created_at": "2000-01-01T00:00:00Z"}, format="json")
        p.refresh_from_db()
        assert p.created_at == original


@pytest.mark.django_db
class TestListing:
    def test_pagination(self, auth_client, make_product):
        for i in range(25):
            make_product(name=f"Item {i:02d}")
        page1 = auth_client.get(LIST).json()
        assert page1["count"] == 25
        assert len(page1["results"]) == 10
        assert page1["previous"] is None
        assert page1["next"].endswith("/api/products/?page=2")

        page3 = auth_client.get(LIST, {"page": 3}).json()
        assert len(page3["results"]) == 5
        assert page3["next"] is None
        assert page3["previous"].endswith("/api/products/?page=2")

        ids = [r["id"] for p in (1, 2, 3) for r in auth_client.get(LIST, {"page": p}).json()["results"]]
        assert len(set(ids)) == 25

    def test_out_of_range_page_is_404(self, auth_client, make_product):
        make_product()
        assert auth_client.get(LIST, {"page": 2}).status_code == 404

    def test_ordering_newest_first_with_id_tiebreak(self, auth_client, make_product):
        a, b, c = make_product(name="a"), make_product(name="b"), make_product(name="c")
        now = timezone.now()
        Product.objects.filter(pk__in=[a.pk, b.pk]).update(created_at=now)
        Product.objects.filter(pk=c.pk).update(created_at=now - timedelta(days=1))
        ids = [r["id"] for r in auth_client.get(LIST).json()["results"]]
        assert ids == [b.id, a.id, c.id]

    def test_category_filter(self, auth_client, make_product, electronics, kitchen):
        make_product(name="Mouse", category=electronics)
        make_product(name="Mug", category=kitchen)
        body = auth_client.get(LIST, {"category": kitchen.id}).json()
        assert body["count"] == 1
        assert [r["name"] for r in body["results"]] == ["Mug"]

    def test_unknown_category_filter_returns_empty(self, auth_client, make_product):
        make_product()
        body = auth_client.get(LIST, {"category": 9999}).json()
        assert body["count"] == 0

    def test_non_numeric_category_filter_is_400(self, auth_client, make_product):
        res = auth_client.get(LIST, {"category": "abc"})
        assert res.status_code == 400
        assert "category" in res.json()

    def test_search_by_name_case_insensitive(self, auth_client, make_product):
        make_product(name="Wireless Mouse")
        make_product(name="Mouse Pad XL")
        make_product(name="Keyboard")
        body = auth_client.get(LIST, {"search": "mOuSe"}).json()
        assert sorted(r["name"] for r in body["results"]) == ["Mouse Pad XL", "Wireless Mouse"]

    def test_search_only_matches_name(self, auth_client, make_product):
        make_product(name="Keyboard")  # category is "Electronics"
        assert auth_client.get(LIST, {"search": "Electronics"}).json()["count"] == 0

    def test_combined_category_and_search(self, auth_client, make_product, electronics, kitchen):
        make_product(name="Wireless Mouse", category=electronics)
        make_product(name="Mouse-shaped Mug", category=kitchen)
        make_product(name="Kettle", category=kitchen)
        body = auth_client.get(LIST, {"category": kitchen.id, "search": "mouse"}).json()
        assert body["count"] == 1
        assert body["results"][0]["name"] == "Mouse-shaped Mug"

    def test_combined_filter_search_and_page(self, auth_client, make_product, electronics, kitchen):
        for i in range(12):
            make_product(name=f"Mouse {i}", category=kitchen)
        for i in range(5):
            make_product(name=f"Mouse {i}", category=electronics)
        make_product(name="Kettle", category=kitchen)
        body = auth_client.get(LIST, {"category": kitchen.id, "search": "mouse", "page": 2}).json()
        assert body["count"] == 12
        assert len(body["results"]) == 2
        assert all(r["category"] == kitchen.id for r in body["results"])
        assert "category=" in body["previous"] and "search=mouse" in body["previous"]

    def test_inactive_products_are_listed_and_retrievable(self, auth_client, make_product):
        inactive = make_product(name="Old Webcam", is_active=False)
        make_product(name="New Webcam")
        body = auth_client.get(LIST).json()
        assert body["count"] == 2
        assert {r["is_active"] for r in body["results"]} == {True, False}
        res = auth_client.get(detail(inactive.id))
        assert res.status_code == 200
        assert res.json()["is_active"] is False


@pytest.mark.django_db
class TestCategories:
    def test_unpaginated_sorted_by_name(self, auth_client):
        for name in ["Kitchen", "Accessories", "Electronics"]:
            Category.objects.create(name=name)
        res = auth_client.get("/api/categories/")
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, list)
        assert [c["name"] for c in body] == ["Accessories", "Electronics", "Kitchen"]
        assert set(body[0]) == {"id", "name"}

    def test_categories_are_read_only(self, auth_client):
        res = auth_client.post("/api/categories/", {"name": "New"}, format="json")
        assert res.status_code == 405
