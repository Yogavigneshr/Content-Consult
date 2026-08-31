import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.services import generate_temp_password, send_credentials_email

User = get_user_model()

class Command(BaseCommand):
    help = "Create or repair the initial Niftybot admin and demo user."

    def handle(self, *args, **options):
        admin_username = os.getenv("NIFTYBOT_ADMIN_USERNAME", "admin")
        admin_email = os.getenv("NIFTYBOT_ADMIN_EMAIL", "admin@niftysoft.in")
        admin_password = os.getenv("NIFTYBOT_ADMIN_PASSWORD")

        admin_user, created = User.objects.get_or_create(
            username=admin_username,
            defaults={
                "email": admin_email,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        changed = False
        if admin_email and admin_user.email != admin_email:
            admin_user.email = admin_email; changed = True
        if not admin_user.is_staff or not admin_user.is_superuser:
            admin_user.is_staff = True; admin_user.is_superuser = True; changed = True
        if created or admin_password:
            admin_user.set_password(admin_password or generate_temp_password())
            changed = True
        if changed:
            admin_user.save()
        self.stdout.write(self.style.SUCCESS(
            f"Admin ready: {admin_user.username} ({admin_user.email})"
            + ("; password updated from NIFTYBOT_ADMIN_PASSWORD" if admin_password else "")
        ))

        username = os.getenv("NIFTYBOT_USER_USERNAME", "demo")
        email = os.getenv("NIFTYBOT_USER_EMAIL", "demo@example.com")
        password = os.getenv("NIFTYBOT_USER_PASSWORD")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_active": True},
        )
        changed = False
        if email and user.email != email:
            user.email = email; changed = True
        if not user.is_active:
            user.is_active = True; changed = True
        if created or password:
            user.set_password(password or generate_temp_password())
            changed = True
        if changed:
            user.save()

        self.stdout.write(self.style.SUCCESS(
            f"Demo user ready: {user.username} ({user.email})"
            + ("; password updated from NIFTYBOT_USER_PASSWORD" if password else "")
        ))

        if created and os.getenv("SEND_SEED_CREDENTIALS", "False").lower() == "true":
            send_credentials_email(user, password or "(see terminal output)")
