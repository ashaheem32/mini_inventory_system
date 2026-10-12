import pytest

from inventory.models import Product
from inventory.serializers import MAX_STOCK

LIST = "/api/products/"


@pytest.fixture
def valid(electronics):
    return {"name": "Mouse", "price": "10.00", "stock": 1, "category": electronics.id}


def post(client, payload):
    return client.post(LIST, payload, format="json")


@pytest.mark.django_db
class TestName:
    def test_trimmed(self, auth_client, valid):
        res = post(auth_client, {**valid, "name": "   Mouse   "})
        assert res.status_code == 201
        assert res.json()["name"] == "Mouse"

    @pytest.mark.parametrize("name", ["", "   ", "\t\n "])
    def test_blank_or_whitespace_rejected(self, auth_client, valid, name):
        res = post(auth_client, {**valid, "name": name})
        assert res.status_code == 400
        assert res.json() == {"name": ["This field may not be blank."]}

    def test_missing_rejected(self, auth_client, valid):
        valid.pop("name")
        res = post(auth_client, valid)
        assert res.json() == {"name": ["This field is required."]}

    def test_too_long_rejected(self, auth_client, valid):
        assert post(auth_client, {**valid, "name": "x" * 201}).status_code == 400
        assert post(auth_client, {**valid, "name": "x" * 200}).status_code == 201


@pytest.mark.django_db
class TestPrice:
    @pytest.mark.parametrize("price", ["0", "0.00", "-1", "-0.01"])
    def test_non_positive_rejected(self, auth_client, valid, price):
        res = post(auth_client, {**valid, "price": price})
        assert res.status_code == 400
        assert res.json() == {"price": ["Price must be greater than zero."]}

    def test_more_than_two_decimals_rejected(self, auth_client, valid):
        res = post(auth_client, {**valid, "price": "1.999"})
        assert res.status_code == 400
        assert "price" in res.json()

    def test_too_many_digits_rejected(self, auth_client, valid):
        res = post(auth_client, {**valid, "price": "123456789.00"})  # 11 digits
        assert res.status_code == 400
        assert "price" in res.json()

    def test_max_value_accepted(self, auth_client, valid):
        res = post(auth_client, {**valid, "price": "99999999.99"})
        assert res.status_code == 201
        assert res.json()["price"] == "99999999.99"

    @pytest.mark.parametrize("price", ["abc", "NaN", "Infinity", ""])
    def test_non_numeric_rejected(self, auth_client, valid, price):
        assert post(auth_client, {**valid, "price": price}).status_code == 400

    def test_smallest_positive_accepted(self, auth_client, valid):
        res = post(auth_client, {**valid, "price": "0.01"})
        assert res.status_code == 201

    def test_numeric_input_returned_as_string(self, auth_client, valid):
        res = post(auth_client, {**valid, "price": 5})
        assert res.json()["price"] == "5.00"


@pytest.mark.django_db
class TestStock:
    def test_negative_rejected(self, auth_client, valid):
        res = post(auth_client, {**valid, "stock": -1})
        assert res.status_code == 400
        assert res.json() == {"stock": ["Stock cannot be negative."]}

    def test_zero_accepted(self, auth_client, valid):
        assert post(auth_client, {**valid, "stock": 0}).status_code == 201

    @pytest.mark.parametrize("stock", [1.5, "2.5", "ten", True, None])
    def test_non_integer_rejected(self, auth_client, valid, stock):
        assert post(auth_client, {**valid, "stock": stock}).status_code == 400

    def test_upper_bound(self, auth_client, valid):
        assert post(auth_client, {**valid, "stock": MAX_STOCK}).status_code == 201
        res = post(auth_client, {**valid, "stock": MAX_STOCK + 1})
        assert res.status_code == 400
        assert "stock" in res.json()


@pytest.mark.django_db
class TestCategory:
    def test_nonexistent_rejected(self, auth_client, valid):
        res = post(auth_client, {**valid, "category": 9999})
        assert res.status_code == 400
        assert res.json() == {"category": ['Invalid pk "9999" - object does not exist.']}

    def test_missing_rejected(self, auth_client, valid):
        valid.pop("category")
        assert post(auth_client, valid).json() == {"category": ["This field is required."]}

    def test_null_rejected(self, auth_client, valid):
        assert post(auth_client, {**valid, "category": None}).status_code == 400

    def test_wrong_type_rejected(self, auth_client, valid):
        assert post(auth_client, {**valid, "category": "abc"}).status_code == 400


@pytest.mark.django_db
def test_multiple_errors_reported_together(auth_client, valid):
    res = post(auth_client, {"name": " ", "price": "0", "stock": -3, "category": 9999})
    assert res.status_code == 400
    assert set(res.json()) == {"name", "price", "stock", "category"}
    assert Product.objects.count() == 0
