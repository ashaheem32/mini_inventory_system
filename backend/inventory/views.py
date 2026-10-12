from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, viewsets

from .filters import ProductFilter
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    pagination_class = None


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category").order_by("-created_at", "-id")
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = ProductFilter
    search_fields = ["name"]
