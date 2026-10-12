from decimal import Decimal

from rest_framework import serializers

from .models import Category, Product

# Portable 32-bit upper bound (PostgreSQL/MySQL integer); SQLite would accept more.
MAX_STOCK = 2_147_483_647


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    # CharField trims surrounding whitespace and rejects blank (incl. whitespace-only) values.
    name = serializers.CharField(max_length=200, trim_whitespace=True, allow_blank=False)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
    stock = serializers.IntegerField(
        min_value=0,
        max_value=MAX_STOCK,
        error_messages={"min_value": "Stock cannot be negative."},
    )
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "price",
            "stock",
            "category",
            "category_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "category_name", "created_at"]

    def validate_price(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value
