import secrets
import string
from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from .models import ActivityLog

User = get_user_model()


def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def log_activity(user, action, description="", metadata=None, request=None):
    ip = None
    if request:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
    return ActivityLog.objects.create(user=user, action=action, description=description[:500], metadata=metadata or {}, ip_address=ip)



def send_password_reset_email(user):
    """Send a five-minute password reset link for an existing account."""
    host = getattr(settings, "EMAIL_HOST", "")
    username = getattr(settings, "EMAIL_HOST_USER", "")
    password_setting = getattr(settings, "EMAIL_HOST_PASSWORD", "")
    if not host or not username or not password_setting:
        raise RuntimeError(
            "SMTP is not configured. Set EMAIL_HOST, EMAIL_HOST_USER and EMAIL_HOST_PASSWORD."
        )

    subject = "Reset your Content Consult password"
    login_url = getattr(settings, "FRONTEND_LOGIN_URL", "https://contentconsult.in/login")
    frontend_base = login_url.rsplit("/login", 1)[0].rstrip("/")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_token = default_token_generator.make_token(user)
    change_password_url = f"{frontend_base}/change-password?uid={uid}&token={reset_token}"
    body = (
        f"Hello {user.first_name or user.username},\n\n"
        "We received a request to reset your Content Consult password.\n\n"
        f"Change password: {change_password_url}\n\n"
        "This secure link expires in 5 minutes and can be used only while it remains valid.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "Content Consult"
    )
    connection = get_connection(
        backend=getattr(settings, "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"),
        fail_silently=False,
    )
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=f'Content Consult <{getattr(settings, "DEFAULT_FROM_EMAIL", username)}>',
        to=[user.email],
        connection=connection,
    )
    sent = message.send(fail_silently=False)
    if sent != 1:
        raise RuntimeError("SMTP accepted the connection but did not report the reset email as sent.")
    return True


def send_credentials_email(user, password):
    """Send account credentials through the configured SMTP provider.

    Fail loudly when SMTP is not configured so the admin UI can report the
    real delivery problem instead of claiming the email was sent.
    """
    host = getattr(settings, "EMAIL_HOST", "")
    username = getattr(settings, "EMAIL_HOST_USER", "")
    password_setting = getattr(settings, "EMAIL_HOST_PASSWORD", "")
    if not host or not username or not password_setting:
        raise RuntimeError(
            "SMTP is not configured. Set EMAIL_HOST, EMAIL_HOST_USER and "
            "EMAIL_HOST_PASSWORD (use a provider app password where required)."
        )
    if "@" in host:
        raise RuntimeError(
            "SMTP host could not be normalized. Use smtp.gmail.com for Gmail or smtp.office365.com for Microsoft 365."
        )

    subject = "Your Content Consult account"
    login_url = getattr(settings, "FRONTEND_LOGIN_URL", "https://contentconsult.in/login")
    frontend_base = login_url.rsplit("/login", 1)[0].rstrip("/")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_token = default_token_generator.make_token(user)
    change_password_url = f"{frontend_base}/change-password?uid={uid}&token={reset_token}"
    body = (
        f"Hello {user.first_name or user.username},\n\n"
        "An administrator created your Content Consult account.\n\n"
        f"Login: {login_url}\n"
        f"Username: {user.username}\n"
        f"Temporary password: {password}\n\n"
        f"Change password: {change_password_url}\n\n"
        "This secure link expires in 5 minutes.\n\n"
        "Content Consult"
    )
    connection = get_connection(
        backend=getattr(settings, "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"),
        fail_silently=False,
    )
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=f'Content Consult <{getattr(settings, "DEFAULT_FROM_EMAIL", username)}>',
        to=[user.email],
        connection=connection,
    )
    sent = message.send(fail_silently=False)
    if sent != 1:
        raise RuntimeError("SMTP accepted the connection but did not report the credential email as sent.")
    return True

# ---- Per-user AI cost budget -------------------------------------------------
from decimal import Decimal
from django.db.models import Sum
from assistant.models import AIUsageEvent


def get_user_budget(user):
    if not user or not getattr(user, "is_authenticated", False) or getattr(user, "is_staff", False):
        return None
    from .models import UserBudget
    budget, _ = UserBudget.objects.get_or_create(user=user, defaults={"cost_limit_usd": Decimal("0.00")})
    spent = AIUsageEvent.objects.filter(user=user).aggregate(total=Sum("cost_usd"))["total"] or Decimal("0")
    return {"limit": Decimal(budget.cost_limit_usd), "spent": Decimal(spent), "remaining": max(Decimal("0"), Decimal(budget.cost_limit_usd) - Decimal(spent))}


def enforce_user_budget(user):
    """Block a new AI request once the user's recorded spend reaches the limit."""
    budget = get_user_budget(user)
    if not budget:
        return None
    if budget["spent"] >= budget["limit"]:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied(
            f"Your AI cost limit of ${budget['limit']:.4f} has been reached. Please contact an administrator to increase your limit."
        )
    return budget
