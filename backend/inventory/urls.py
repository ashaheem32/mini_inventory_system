from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CategoryListView, ProductViewSet

router = SimpleRouter(trailing_slash=True)
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    *router.urls,
]
