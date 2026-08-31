import csv
import io
import os
import zipfile
from datetime import datetime, timedelta
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ActivityLog, UserBudget
from .serializers import UserSerializer, CreateUserSerializer
from .services import generate_temp_password, log_activity, send_credentials_email, send_password_reset_email
from content.models import GeneratedContent
from sites_app.models import AIPlatformSettings, AIProviderConfig, Site, AISettings
from content.ai import get_provider_catalog, _configured_provider_key
from assistant.models import AIUsageEvent, ChatSession

User = get_user_model()

class LoginView(APIView):
    permission_classes = []
    authentication_classes = []
    def post(self, request):
        identifier = request.data.get("identifier") or request.data.get("username") or request.data.get("email") or ""
        identifier = identifier.strip()
        password = request.data.get("password", "")
        user = None

        # Allow either username OR email address.
        # Email matching is case-insensitive and only succeeds when exactly
        # one account owns that email address.
        if "@" in identifier:
            matches = User.objects.filter(email__iexact=identifier, is_active=True)
            if matches.count() == 1:
                candidate = matches.first()
                if candidate.check_password(password):
                    user = candidate
        else:
            user = authenticate(request, username=identifier, password=password)

        if not user or not user.is_active:
            return Response({"detail": "Invalid email/username or password."}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        log_activity(user, "login", "User signed in", request=request)
        return Response({"token": token.key, "user": UserSerializer(user).data})

class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

class ChangePasswordView(APIView):
    def post(self, request):
        current = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        if not request.user.check_password(current):
            return Response({"detail": "Current password is incorrect."}, status=400)
        try:
            validate_password(new_password, request.user)
        except Exception as exc:
            return Response({"detail": " ".join(getattr(exc, "messages", ["Password is not valid."]))}, status=400)
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        Token.objects.filter(user=request.user).delete()
        token = Token.objects.create(user=request.user)
        log_activity(request.user, "password_change", "Changed account password", request=request)
        return Response({"detail": "Password changed successfully.", "token": token.key})


class PasswordResetRequestView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if not email:
            return Response({"detail": "Enter your account email."}, status=400)

        # Do not reveal whether an email address belongs to an account.
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            try:
                send_password_reset_email(user)
            except Exception:
                return Response({"detail": "We could not send the password reset email right now. Please try again later."}, status=503)

        return Response({"detail": "If an account exists for that email, a password reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = []
    authentication_classes = []
    def post(self, request):
        uid = request.data.get("uid", "")
        reset_token = request.data.get("token", "")
        new_password = request.data.get("password", "")
        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id, is_active=True)
        except Exception:
            user = None
        if not user or not default_token_generator.check_token(user, reset_token):
            return Response({"detail": "This password link is invalid or has expired."}, status=400)
        try:
            validate_password(new_password, user)
        except Exception as exc:
            return Response({"detail": " ".join(getattr(exc, "messages", ["Password is not valid."]))}, status=400)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
        log_activity(user, "password_change", "Set password from emailed password link", request=request)
        return Response({"detail": "Password changed successfully."})


class AdminRequired(permissions.IsAdminUser):
    pass

class AdminDashboardView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        period = request.query_params.get("period", "all")
        now = timezone.now()
        since = None
        if period == "7d": since = now - timedelta(days=7)
        elif period == "30d": since = now - timedelta(days=30)
        elif period == "90d": since = now - timedelta(days=90)
        users = User.objects.filter(is_staff=False)
        content = GeneratedContent.objects.all()
        activities = ActivityLog.objects.all()
        if since:
            users = users.filter(date_joined__gte=since)
            content = content.filter(created_at__gte=since)
            activities = activities.filter(created_at__gte=since)
        return Response({
            "period": period,
            "users": users.count(),
            "active_users": users.filter(is_active=True).count(),
            "content_generations": content.count(),
            "activities": activities.count(),
            "drafts": content.filter(status="draft").count(),
            "approved": content.filter(status="approved").count(),
            "sites": Site.objects.count(),
        })

class AdminAIUsageView(APIView):
    permission_classes = [AdminRequired]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today_start.replace(day=1)
        qs = AIUsageEvent.objects.select_related("user", "session", "site").all()
        today = qs.filter(created_at__gte=today_start)
        month = qs.filter(created_at__gte=month_start)

        def totals(queryset):
            data = queryset.aggregate(
                api_calls=Sum("api_calls"), input_tokens=Sum("input_tokens"),
                output_tokens=Sum("output_tokens"), total_tokens=Sum("total_tokens"),
                cost_usd=Sum("cost_usd")
            )
            result = {key: data[key] or 0 for key in data}
            # Prefer recorded total; otherwise derive from input + output tokens
            if not result["total_tokens"]:
                result["total_tokens"] = int(result["input_tokens"] or 0) + int(result["output_tokens"] or 0)
            return result

        session_ids = list(qs.values_list("session_id", flat=True).distinct())
        recent_sessions = []
        for session in ChatSession.objects.filter(id__in=[x for x in session_ids if x]).select_related("user").order_by("-updated_at")[:25]:
            events = qs.filter(session=session)
            aggregate = totals(events)
            last = events.order_by("-created_at").first()
            recent_sessions.append({
                "session_id": str(session.id),
                "user": session.user.username if session.user else "Unknown",
                "messages": session.messages.filter(role="user").count(),
                "api_calls": int(aggregate["api_calls"]),
                "input_tokens": int(aggregate["input_tokens"]),
                "output_tokens": int(aggregate["output_tokens"]),
                "total_tokens": int(aggregate["total_tokens"]),
                "cost_usd": str(aggregate["cost_usd"]),
                "provider": last.provider if last else "",
                "model": last.model if last else "",
                "updated_at": session.updated_at,
            })

        providers = []
        for row in qs.values("provider", "model").annotate(
            api_calls=Sum("api_calls"), input_tokens=Sum("input_tokens"), output_tokens=Sum("output_tokens"),
            total_tokens=Sum("total_tokens"), cost_usd=Sum("cost_usd")
        ).order_by("-cost_usd"):
            providers.append({**row, "cost_usd": str(row["cost_usd"] or 0)})

        return Response({
            "today": totals(today),
            "month": totals(month),
            "all_time": totals(qs),
            "recent_chats": recent_sessions,
            "providers": providers,
        })

    def delete(self, request):
        AIUsageEvent.objects.all().delete()
        log_activity(request.user, "admin_ai_usage", "Cleared AI usage history", request=request)
        return Response(status=204)


class AdminUsersView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        users = User.objects.filter(is_staff=False).select_related("budget").annotate(activity_count=Count("activity_logs")).order_by("-date_joined")
        return Response(UserSerializer(users, many=True).data)
    def post(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        password = generate_temp_password()
        user = User.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=password,
            first_name="",
            last_name="",
        )
        UserBudget.objects.create(user=user, cost_limit_usd="0.0000")
        sent = False
        email_error = ""
        if data.get("send_credentials", True):
            try:
                send_credentials_email(user, password)
                sent = True
            except Exception as exc:
                # SMTP/DNS misconfiguration must not block account creation.
                email_error = str(exc)
        log_activity(
            request.user,
            "admin_create_user",
            f"Created user {user.username}",
            {"user_id": user.id, "email_sent": sent, "email_error": (email_error or "")[:200]},
            request,
        )
        payload = {
            "user": UserSerializer(user).data,
            "email_sent": sent,
            "temporary_password": None if sent else password,
        }
        if email_error and not sent:
            payload["email_error"] = email_error
            payload["detail"] = (
                f"User {user.username} was created, but credentials could not be emailed "
                f"({email_error}). Share the temporary password manually."
            )
        return Response(payload, status=201)

class AdminUserReportView(APIView):
    """Return a focused operational report for one non-admin user."""
    permission_classes = [AdminRequired]

    def get(self, request, user_id):
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)

        content_qs = GeneratedContent.objects.select_related("site").filter(created_by=user)
        activity_qs = ActivityLog.objects.filter(user=user)
        usage_qs = AIUsageEvent.objects.filter(user=user)
        sessions_qs = ChatSession.objects.filter(user=user)

        content_totals = content_qs.aggregate(
            total=Count("id"),
            drafts=Count("id", filter=Q(status="draft")),
            approved=Count("id", filter=Q(status="approved")),
            words=Sum("word_count"),
        )
        usage_totals = usage_qs.aggregate(
            api_calls=Sum("api_calls"),
            input_tokens=Sum("input_tokens"),
            output_tokens=Sum("output_tokens"),
            total_tokens=Sum("total_tokens"),
            cost_usd=Sum("cost_usd"),
        )

        by_type = []
        for row in content_qs.values("content_type").annotate(
            count=Count("id"), words=Sum("word_count")
        ).order_by("-count", "content_type"):
            by_type.append({
                "content_type": row["content_type"],
                "count": row["count"],
                "words": row["words"] or 0,
            })

        by_provider = []
        for row in usage_qs.values("provider").annotate(
            api_calls=Sum("api_calls"),
            total_tokens=Sum("total_tokens"),
            cost_usd=Sum("cost_usd"),
        ).order_by("-cost_usd"):
            by_provider.append({
                "provider": row["provider"],
                "api_calls": row["api_calls"] or 0,
                "total_tokens": row["total_tokens"] or 0,
                "cost_usd": str(row["cost_usd"] or 0),
            })

        recent_content = []
        for item in content_qs.order_by("-created_at")[:10]:
            recent_content.append({
                "id": item.id,
                "title": item.title,
                "topic": item.topic,
                "content_type": item.content_type,
                "status": item.status,
                "word_count": item.word_count,
                "created_at": item.created_at,
            })

        recent_activity = []
        for item in activity_qs[:15]:
            recent_activity.append({
                "id": item.id,
                "action_key": item.action,
                "action": item.get_action_display(),
                "description": item.description,
                "created_at": item.created_at,
            })

        recent_usage = []
        for item in usage_qs.select_related("site").order_by("-created_at")[:10]:
            recent_usage.append({
                "id": item.id,
                "feature": item.get_feature_display(),
                "provider": item.provider,
                "model": item.model,
                "api_calls": item.api_calls,
                "total_tokens": item.total_tokens or (item.input_tokens + item.output_tokens),
                "cost_usd": str(item.cost_usd or 0),
                "created_at": item.created_at,
            })

        last_activity = activity_qs.order_by("-created_at").first()
        last_content = content_qs.order_by("-created_at").first()
        total_tokens = usage_totals["total_tokens"] or ((usage_totals["input_tokens"] or 0) + (usage_totals["output_tokens"] or 0))

        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_active": user.is_active,
                "date_joined": user.date_joined,
                "cost_limit_usd": str(getattr(getattr(user, "budget", None), "cost_limit_usd", "0.0000")),
            },
            "summary": {
                "content_total": content_totals["total"] or 0,
                "drafts": content_totals["drafts"] or 0,
                "approved": content_totals["approved"] or 0,
                "total_words": content_totals["words"] or 0,
                "activity_total": activity_qs.count(),
                "chat_sessions": sessions_qs.count(),
                "chat_messages": sum(session.messages.filter(role="user").count() for session in sessions_qs),
                "ai_api_calls": usage_totals["api_calls"] or 0,
                "input_tokens": usage_totals["input_tokens"] or 0,
                "output_tokens": usage_totals["output_tokens"] or 0,
                "total_tokens": total_tokens,
                "cost_usd": str(usage_totals["cost_usd"] or 0),
                "cost_limit_usd": str(getattr(getattr(user, "budget", None), "cost_limit_usd", "0.0000")),
                "last_activity": last_activity.created_at if last_activity else None,
                "last_content": last_content.created_at if last_content else None,
            },
            "content_by_type": by_type,
            "usage_by_provider": by_provider,
            "recent_content": recent_content,
            "recent_activity": recent_activity,
            "recent_usage": recent_usage,
        })


class AdminDeleteUserView(APIView):
    permission_classes = [AdminRequired]
    def patch(self, request, user_id):
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)
        if "password" in request.data:
            new_password = str(request.data.get("password") or "")
            try:
                validate_password(new_password, user)
            except Exception as exc:
                return Response({"detail": " ".join(getattr(exc, "messages", ["Password is not valid."]))}, status=400)
            user.set_password(new_password)
            user.save(update_fields=["password"])
            Token.objects.filter(user=user).delete()
            log_activity(request.user, "admin_password_reset", f"Reset password for {user.username}", {"user_id": user.id}, request)
            return Response({"detail": "Password reset successfully.", "user": UserSerializer(user).data})
        if "is_active" not in request.data:
            return Response({"detail": "is_active or password is required."}, status=400)
        user.is_active = bool(request.data.get("is_active"))
        user.save(update_fields=["is_active"])
        state = "activated" if user.is_active else "deactivated"
        log_activity(request.user, "admin_create_user", f"{state.title()} user {user.username}", {"user_id": user.id, "is_active": user.is_active}, request)
        return Response(UserSerializer(user).data)

    def delete(self, request, user_id):
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)
        username = user.username
        user.delete()
        log_activity(request.user, "admin_delete_user", f"Deleted user {username}", {"username": username}, request)
        return Response(status=204)

class AdminUserBudgetView(APIView):
    permission_classes = [AdminRequired]

    def patch(self, request, user_id):
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)
        raw = request.data.get("cost_limit_usd")
        try:
            from decimal import Decimal, InvalidOperation
            limit = Decimal(str(raw))
            if limit < 0:
                raise InvalidOperation
            limit = limit.quantize(Decimal("0.0001"))
        except Exception:
            return Response({"detail": "Enter a valid non-negative USD cost limit."}, status=400)
        budget, _ = UserBudget.objects.get_or_create(user=user, defaults={"cost_limit_usd": Decimal("0.0000")})
        budget.cost_limit_usd = limit
        budget.save(update_fields=["cost_limit_usd", "updated_at"])
        log_activity(request.user, "admin_create_user", f"Updated AI cost limit for {user.username}", {"user_id": user.id, "cost_limit_usd": str(limit)}, request)
        return Response({"user_id": user.id, "username": user.username, "cost_limit_usd": str(limit)})


class AdminResetPasswordView(APIView):
    permission_classes = [AdminRequired]
    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)
        new_password = str(request.data.get("password") or "")
        try:
            validate_password(new_password, user)
        except Exception as exc:
            return Response({"detail": " ".join(getattr(exc, "messages", ["Password is not valid."]))}, status=400)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
        log_activity(request.user, "admin_password_reset", f"Reset password for {user.username}", {"user_id": user.id}, request)
        return Response({"detail": "Password reset successfully."})


class AdminActivityView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        qs = ActivityLog.objects.select_related("user").all()
        action = request.query_params.get("action", "").strip()
        user_id = request.query_params.get("user_id", "").strip()
        period = request.query_params.get("period", "all")
        if action: qs = qs.filter(action=action)
        if user_id: qs = qs.filter(user_id=user_id)
        if period in {"7d", "30d", "90d"}:
            qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=int(period[:-1])))
        qs = qs[:300]
        return Response([{
            "id": item.id,
            "user": item.user.username if item.user else "System",
            "user_id": item.user_id,
            "action_key": item.action,
            "action": item.get_action_display(),
            "description": item.description,
            "created_at": item.created_at,
        } for item in qs])


class AdminContentView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        qs = GeneratedContent.objects.select_related("created_by", "site").all()
        query = request.query_params.get("q", "").strip()
        content_type = request.query_params.get("type", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        user_id = request.query_params.get("user_id", "").strip()
        if query:
            qs = qs.filter(Q(title__icontains=query) | Q(topic__icontains=query) | Q(body__icontains=query))
        if content_type: qs = qs.filter(content_type=content_type)
        if status_filter: qs = qs.filter(status=status_filter)
        if user_id: qs = qs.filter(created_by_id=user_id)
        qs = qs[:300]
        return Response([{
            "id": x.id, "title": x.title, "topic": x.topic, "content_type": x.content_type,
            "status": x.status, "word_count": x.word_count, "user": x.created_by.username if x.created_by else "Unknown",
            "user_id": x.created_by_id,
            "created_at": x.created_at, "body_preview": (x.body or "")[:240],
            "body": x.body or "",
            "metadata": x.metadata if isinstance(x.metadata, dict) else {},
        } for x in qs])


class AdminDeleteContentView(APIView):
    permission_classes = [AdminRequired]
    def delete(self, request, content_id):
        item = GeneratedContent.objects.filter(id=content_id).first()
        if not item: return Response({"detail": "Content not found."}, status=404)
        title = item.title or item.topic or f"Content #{item.id}"
        item_id = item.id
        item.delete()
        log_activity(request.user, "admin_delete_content", f"Deleted content {title}", {"content_id": item_id}, request)
        return Response(status=204)


class AdminSitesView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        return Response([{
            "id": s.id, "name": s.name, "domain": s.domain, "language": s.language,
            "brand_voice": s.brand_voice, "created_at": s.created_at,
            "content_count": s.contents.count(),
        } for s in Site.objects.all().order_by("name")])


class AdminSystemView(APIView):
    permission_classes = [AdminRequired]

    def get(self, request):
        catalog = get_provider_catalog()
        platform = AIPlatformSettings.get_solo()
        sites = Site.objects.all().order_by("name")
        provider_configs = {item.provider: item for item in AIProviderConfig.objects.all()}
        for item in catalog:
            stored = provider_configs.get(item["id"])
            db_key = stored.get_api_key() if stored else ""
            # The admin-managed database key is authoritative.  The provider
            # catalog previously only reflected environment variables, which
            # made a valid stored Gemini key appear as "No key" in the UI.
            has_database_key = bool(db_key)
            has_environment_key = bool(item.get("configured")) and not has_database_key
            item["configured"] = has_database_key or has_environment_key
            item["key_source"] = "database" if has_database_key else ("environment" if has_environment_key else "none")
            # The key itself — even masked — is never sent to the browser.
            # Only whether a key is configured, and where it comes from.
            item["is_active"] = item["id"] == platform.active_provider
        return Response({
            "active_provider": platform.active_provider,
            "providers": catalog,
            "site_providers": [{
                "site_id": site.id,
                "site_name": site.name,
                "provider": getattr(getattr(site, "ai_settings", None), "provider", platform.active_provider),
                "model": getattr(getattr(site, "ai_settings", None), "model", ""),
            } for site in sites],
            "django_debug": os.getenv("DJANGO_DEBUG", "False").lower() == "true",
            "allowed_hosts": os.getenv("DJANGO_ALLOWED_HOSTS", "").split(","),
            "database": "configured",
        })

    def patch(self, request):
        provider = str(request.data.get("provider") or "").strip().lower()
        if provider in {"chatgpt", "openai"}: provider = "openai"
        elif provider in {"claude", "anthropic"}: provider = "anthropic"
        elif provider in {"xai", "grok"}: provider = "xai"
        elif provider != "gemini":
            return Response({"detail": "Choose Gemini, ChatGPT / OpenAI, Claude, or Grok / xAI."}, status=400)

        provider_info = next((item for item in get_provider_catalog() if item["id"] == provider), None)
        if not provider_info:
            return Response({"detail": "Provider is unavailable."}, status=400)

        config, _ = AIProviderConfig.objects.get_or_create(provider=provider)
        api_key = request.data.get("api_key")
        clearing_key = api_key is not None and not str(api_key).strip() and bool(request.data.get("clear_api_key"))
        if api_key is not None:
            api_key = str(api_key).strip()
            if api_key:
                config.set_api_key(api_key)
            elif request.data.get("clear_api_key"):
                config.set_api_key("")
            config.model = config.model or provider_info["model"]
            config.save()
        elif not config.configured and not provider_info["configured"]:
            return Response({"detail": f"Enter the {provider_info['label']} API key before making it active."}, status=400)

        # Removing a key should never silently switch which provider serves
        # every user. Only re-check active_provider when this request is
        # purely a "clear the key" action (no explicit switch requested).
        set_active = bool(request.data.get("set_active", not clearing_key))
        if clearing_key and not set_active:
            log_activity(
                request.user, "admin_ai_provider",
                f"Removed stored API key for {provider_info['label']}",
                {"provider": provider, "api_key_updated": False}, request
            )
            return Response({
                "active_provider": AIPlatformSettings.get_solo().active_provider,
                "provider": provider,
                "model": config.model or provider_info["model"],
                "configured": bool(_configured_provider_key(provider)),
            })

        # Backward-compatible optional site_id: keep site metadata in sync,
        # but the platform-level active provider controls every user request.
        site_id = request.data.get("site_id")
        if site_id:
            site = Site.objects.filter(id=site_id).first()
            if site:
                site_settings, _ = AISettings.objects.get_or_create(site=site)
                site_settings.provider = provider
                site_settings.model = config.model or provider_info["model"]
                site_settings.save(update_fields=["provider", "model"])

        platform = AIPlatformSettings.get_solo()
        platform.active_provider = provider
        platform.save(update_fields=["active_provider", "updated_at"])
        log_activity(
            request.user, "admin_ai_provider",
            f"Set active AI provider to {provider_info['label']}",
            {"provider": provider, "api_key_updated": bool(api_key)}, request
        )
        return Response({
            "active_provider": provider,
            "provider": provider,
            "model": config.model or provider_info["model"],
            "configured": True,
        })


class AdminExportAllView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        log_activity(request.user, "export_activity", "Exported complete admin data archive", request=request)
        mem = io.BytesIO()
        with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as archive:
            users = [["ID","Username","Email","Active","Joined","Cost limit (USD)"]]
            users += [[u.id,u.username,u.email,u.is_active,u.date_joined.isoformat(),str(getattr(getattr(u, "budget", None), "cost_limit_usd", "0.0000"))] for u in User.objects.filter(is_staff=False).select_related("budget").order_by("username")]
            archive.writestr("users.csv", "\n".join(",".join('"'+str(v).replace('"','""')+'"' for v in row) for row in users))
            contents = [["ID","User","Type","Title","Topic","Status","Created at"]]
            contents += [[x.id,x.created_by.username if x.created_by else "Unknown",x.content_type,x.title,x.topic,x.status,x.created_at.isoformat()] for x in GeneratedContent.objects.select_related("created_by").all()]
            archive.writestr("content.csv", "\n".join(",".join('"'+str(v).replace('"','""')+'"' for v in row) for row in contents))
            activity = [["ID","User","Action","Description","Created at"]]
            activity += [[a.id,a.user.username if a.user else "System",a.get_action_display(),a.description,a.created_at.isoformat()] for a in ActivityLog.objects.select_related("user").all()]
            archive.writestr("activity.csv", "\n".join(",".join('"'+str(v).replace('"','""')+'"' for v in row) for row in activity))
            usage = [["ID","User","Feature","Provider","Model","API calls","Input tokens","Output tokens","Total tokens","Cost USD","Created at"]]
            usage += [[u.id,u.user.username if u.user else "Unknown",u.feature,u.provider,u.model,u.api_calls,u.input_tokens,u.output_tokens,u.total_tokens,u.cost_usd,u.created_at.isoformat()] for u in AIUsageEvent.objects.select_related("user").all()]
            archive.writestr("ai_usage.csv", "\n".join(",".join('"'+str(v).replace('"','""')+'"' for v in row) for row in usage))
        mem.seek(0)
        response = HttpResponse(mem.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = 'attachment; filename="niftybot-admin-export.zip"'
        return response


def csv_response(filename, rows):
    # Build the CSV in memory and return a normal HttpResponse.
    # StreamingHttpResponse is an iterator response and is not writable by
    # csv.writer directly; doing so raises: "StreamingHttpResponse instance is not writable".
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    for row in rows:
        writer.writerow(row)
    return response

class AdminExportUsersView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        log_activity(request.user, "export_users", "Exported user data", request=request)
        users = User.objects.filter(is_staff=False).order_by("username")
        rows = [["ID", "Username", "Email", "First name", "Last name", "Active", "Joined", "Cost limit (USD)"]]
        rows += [[u.id,u.username,u.email,u.first_name,u.last_name,u.is_active,u.date_joined.isoformat(),str(getattr(getattr(u, "budget", None), "cost_limit_usd", "0.0000"))] for u in users]
        return csv_response("niftybot-users.csv", rows)

class AdminExportActivityView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        log_activity(request.user, "export_activity", "Exported activity data", request=request)
        rows = [["ID", "User", "Action", "Description", "Created at"]]
        for a in ActivityLog.objects.select_related("user").all():
            rows.append([a.id, a.user.username if a.user else "System", a.get_action_display(), a.description, a.created_at.isoformat()])
        return csv_response("niftybot-activity.csv", rows)

class AdminExportSearchesView(APIView):
    permission_classes = [AdminRequired]
    def get(self, request):
        user_id = request.query_params.get("user_id")
        qs = GeneratedContent.objects.select_related("created_by").order_by("-created_at")
        if user_id: qs = qs.filter(created_by_id=user_id)
        log_activity(request.user, "export_searches", "Exported user search/content data", {"user_id": user_id}, request)
        rows = [["ID","User","Content type","Topic / search","Title","Status","Words","Content","Created at"]]
        for item in qs:
            rows.append([item.id, item.created_by.username if item.created_by else "Unknown", item.content_type, item.topic, item.title, item.status, item.word_count, item.body or "", item.created_at.isoformat()])
        return csv_response("niftybot-user-search-data.csv", rows)


class AdminExportUserReportView(APIView):
    """Export only the requested user-report section; omit section for a full report."""
    permission_classes = [AdminRequired]

    def get(self, request):
        user_id = request.query_params.get("user_id")
        section = (request.query_params.get("section") or "all").strip().lower()
        if not user_id:
            return Response({"detail": "user_id is required."}, status=400)
        user = User.objects.filter(id=user_id, is_staff=False).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)
        allowed = {"all", "content", "providers", "generated", "activity", "usage"}
        if section not in allowed:
            return Response({"detail": "Unknown report section."}, status=400)

        rows = []
        if section in {"all", "content", "generated"}:
            rows.append(["ID", "User", "Content type", "Topic", "Title", "Status", "Words", "Content", "Created at"])
            qs = GeneratedContent.objects.select_related("created_by").filter(created_by=user).order_by("-created_at")
            for item in qs:
                rows.append([item.id, user.username, item.content_type, item.topic, item.title, item.status, item.word_count, item.body or "", item.created_at.isoformat()])
            if section != "all":
                log_activity(request.user, "export_searches", f"Exported {section} report for {user.username}", {"user_id": user.id, "section": section}, request)
                return csv_response(f"niftybot-user-{user.id}-{section}.csv", rows)

        if section in {"all", "providers"}:
            rows.append([])
            rows.append(["AI usage by provider", "Provider", "Model", "API calls", "Input tokens", "Output tokens", "Total tokens", "Cost USD"])
            usage_qs = AIUsageEvent.objects.filter(user=user)
            grouped = usage_qs.values("provider", "model").annotate(api_calls=Sum("api_calls"), input_tokens=Sum("input_tokens"), output_tokens=Sum("output_tokens"), total_tokens=Sum("total_tokens"), cost_usd=Sum("cost_usd")).order_by("provider", "model")
            for item in grouped:
                rows.append(["", item["provider"], item["model"], item["api_calls"] or 0, item["input_tokens"] or 0, item["output_tokens"] or 0, item["total_tokens"] or 0, item["cost_usd"] or 0])
            if section != "all":
                log_activity(request.user, "export_activity", f"Exported provider report for {user.username}", {"user_id": user.id, "section": section}, request)
                return csv_response(f"niftybot-user-{user.id}-providers.csv", rows)

        if section in {"all", "activity"}:
            rows.append([])
            rows.append(["Activity", "Action", "Description", "Created at"])
            for item in ActivityLog.objects.filter(user=user).order_by("-created_at"):
                rows.append(["", item.get_action_display(), item.description, item.created_at.isoformat()])
            if section != "all":
                log_activity(request.user, "export_activity", f"Exported activity report for {user.username}", {"user_id": user.id, "section": section}, request)
                return csv_response(f"niftybot-user-{user.id}-activity.csv", rows)

        if section in {"all", "usage"}:
            rows.append([])
            rows.append(["AI usage", "Feature", "Provider", "Model", "API calls", "Input tokens", "Output tokens", "Total tokens", "Cost USD", "Created at"])
            for item in AIUsageEvent.objects.filter(user=user).order_by("-created_at"):
                rows.append(["", item.feature, item.provider, item.model, item.api_calls, item.input_tokens, item.output_tokens, item.total_tokens, item.cost_usd, item.created_at.isoformat()])
            if section != "all":
                log_activity(request.user, "export_activity", f"Exported AI usage report for {user.username}", {"user_id": user.id, "section": section}, request)
                return csv_response(f"niftybot-user-{user.id}-usage.csv", rows)

        log_activity(request.user, "export_activity", f"Exported full report for {user.username}", {"user_id": user.id, "section": "all"}, request)
        return csv_response(f"niftybot-user-{user.id}-full-report.csv", rows)
