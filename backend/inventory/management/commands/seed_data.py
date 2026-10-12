import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Category, Product

DEMO_USERNAME = "demo"
DEFAULT_DEMO_PASSWORD = "demo-pass-2026"

# (name, price, stock, is_active)
SEED_PRODUCTS: dict[str, list[tuple[str, str, int, bool]]] = {
    "Electronics": [
        ("Wireless Mouse", "49.90", 18, True),
        ("Mechanical Keyboard", "129.00", 7, True),
        ("27-inch Monitor", "899.00", 4, True),
        ("USB-C Hub", "79.50", 0, True),
        ("Noise-Cancelling Headphones", "349.99", 12, True),
        ("Webcam HD", "159.00", 3, False),
    ],
    "Office Supplies": [
        ("A4 Copy Paper (500 sheets)", "22.50", 120, True),
        ("Ballpoint Pens (12 pack)", "15.75", 64, True),
        ("Stapler", "28.00", 0, True),
        ("Sticky Notes", "9.95", 200, True),
        ("Desk Organizer", "45.00", 15, True),
        ("Whiteboard Markers", "18.25", 0, False),
    ],
    "Kitchen": [
        ("Coffee Mug", "24.00", 40, True),
        ("Electric Kettle", "119.00", 9, True),
        ("Water Bottle", "35.50", 0, True),
        ("Lunch Box", "42.00", 22, True),
        ("Paper Towels (6 rolls)", "27.90", 30, True),
        ("French Press", "89.00", 5, False),
    ],
    "Accessories": [
        ("Laptop Backpack", "189.00", 11, True),
        ("Laptop Stand", "135.00", 6, True),
        ("Phone Charger 20W", "59.00", 0, True),
        ("HDMI Cable 2m", "25.00", 75, True),
        ("Mouse Pad XL", "39.00", 28, True),
        ("Screen Cleaning Kit", "19.90", 14, False),
    ],
}


class Command(BaseCommand):
    help = (
        "Seed demo categories, products and a demo user. Safe to run repeatedly: existing "
        "rows are left untouched and the demo password is only set when the user is created."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-demo-password",
            action="store_true",
            help="Reset the demo user's password even if the user already exists.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        categories_created = products_created = 0

        for category_name, products in SEED_PRODUCTS.items():
            category, created = Category.objects.get_or_create(name=category_name)
            categories_created += created
            for name, price, stock, is_active in products:
                _, created = Product.objects.get_or_create(
                    name=name,
                    category=category,
                    defaults={"price": Decimal(price), "stock": stock, "is_active": is_active},
                )
                products_created += created

        password = os.environ.get("DEMO_PASSWORD") or DEFAULT_DEMO_PASSWORD
        user, user_created = get_user_model().objects.get_or_create(username=DEMO_USERNAME)
        if user_created or options["reset_demo_password"]:
            user.set_password(password)  # Django password hashing
            user.save(update_fields=["password"])

        if user_created:
            user_msg = f"created user '{DEMO_USERNAME}'"
        elif options["reset_demo_password"]:
            user_msg = f"reset password for '{DEMO_USERNAME}'"
        else:
            user_msg = f"user '{DEMO_USERNAME}' already exists (password unchanged)"

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {categories_created} categories and {products_created} products "
                f"created ({Category.objects.count()} categories, {Product.objects.count()} products "
                f"total); {user_msg}."
            )
        )
