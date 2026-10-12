from django.contrib import admin

from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "price", "stock", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("name",)
    list_select_related = ("category",)
