"""
Django settings for the AI assistant backend.

This is a minimal, production-lean settings file. Drop it into a normal
`django-admin startproject core .` scaffold (it assumes that layout), or
copy the relevant blocks into your existing settings.py.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "accounts",
    "corsheaders",
    "assistant",
    "sites_app",
    "content",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # must be high up, before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

DB_ENGINE = os.environ.get("DB_ENGINE", "django.db.backends.sqlite3")
if DB_ENGINE == "django.db.backends.mysql":
    DATABASES = {"default": {
        "ENGINE": DB_ENGINE,
        "NAME": os.environ.get("DB_NAME", "niftybot"),
        "USER": os.environ.get("DB_USER", "root"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
        "PORT": os.environ.get("DB_PORT", "3306"),
        "OPTIONS": {"charset": "utf8mb4"},
    }}
else:
    DATABASES = {"default": {
        "ENGINE": DB_ENGINE,
        "NAME": BASE_DIR / os.environ.get("DB_NAME", "db.sqlite3"),
    }}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Local cache reduces duplicate AI calls without requiring Redis. In production,
# this can be replaced with a shared Redis cache.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "niftybot-ai-cache"}}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": "180/min",
        "anon": "10/min",
    },
}

# --- CORS -------------------------------------------------------------
# In production, lock this down to the exact origins that will embed the
# widget. Never use CORS_ALLOW_ALL_ORIGINS = True with credentials on a
# public endpoint that costs you money per call.
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173,https://localhost:5173,https://127.0.0.1:5173"
).split(",")

# The frontend widgets send a custom X-API-Key header to identify
# which Site the request belongs to. corsheaders' default allow-list only
# covers standard headers, so it must be extended explicitly or browsers
# reject the preflight before the request ever reaches Django.
from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOW_HEADERS = list(default_headers) + ["x-api-key"]

# --- Gemini -------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
# When enabled, Gemini uses Google Cloud Vertex AI with Application Default
# Credentials (ADC). On Compute Engine this normally means the VM's attached
# service account; no Gemini API key is exposed to the application.
GEMINI_USE_VERTEX_AI = os.environ.get("GEMINI_USE_VERTEX_AI", "False").strip().lower() in {"1", "true", "yes", "on"}
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", os.environ.get("GCLOUD_PROJECT", ""))
GOOGLE_CLOUD_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5")
XAI_API_KEY = os.environ.get("XAI_API_KEY", "")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-3-mini")

# Hard cap on how much page context text we forward to the model, to keep
# prompts cheap and avoid a hostile page trying to inject huge payloads.
MAX_CONTEXT_CHARS = int(os.environ.get("MAX_CONTEXT_CHARS", 6000))


# --- SMTP --------------------------------------------------------------
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com").strip()
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "").strip()
# Be forgiving of the common mistake EMAIL_HOST=<sender email>.
# For known providers, normalize it to the actual SMTP hostname.
if "@" in EMAIL_HOST:
    host_domain = EMAIL_HOST.rsplit("@", 1)[-1].lower()
    if host_domain in {"gmail.com", "googlemail.com"}:
        EMAIL_HOST = "smtp.gmail.com"
    elif host_domain in {"outlook.com", "hotmail.com", "live.com"}:
        EMAIL_HOST = "smtp.office365.com"
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "False") == "True"
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "20"))
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
_default_from = os.environ.get("DEFAULT_FROM_EMAIL", "").strip()
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER or _default_from or "noreply@contentconsult.local"
if DEFAULT_FROM_EMAIL.lower() in {"your-email@gmail.com", "your-email@example.com"} and EMAIL_HOST_USER:
    DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
FRONTEND_LOGIN_URL = os.environ.get("FRONTEND_LOGIN_URL", "https://contentconsult.in/login")
# Password reset links (including administrator-created temporary-password links) expire after 5 minutes.
PASSWORD_RESET_TIMEOUT = 300



GOOGLE_CLOUD_LOCATION = os.getenv(
    "GOOGLE_CLOUD_LOCATION",
    "us-central1"
)


# trigger reload
