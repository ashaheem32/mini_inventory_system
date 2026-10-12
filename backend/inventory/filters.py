import django_filters

from .models import Product


class ProductFilter(django_filters.FilterSet):
    # NumberFilter: a well-formed but unknown category id yields an empty page, not an error.
    category = django_filters.NumberFilter(field_name="category_id")

    class Meta:
        model = Product
        fields = ["category"]
