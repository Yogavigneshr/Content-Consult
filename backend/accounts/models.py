from django.conf import settings
from django.db import models
from decimal import Decimal


class ActivityLog(models.Model):
    ACTIONS = [
        ("login", "Login"),
        ("logout", "Logout"),
        ("generate", "Generate content"),
        ("save_draft", "Save draft"),
        ("chat", "AI chat"),
        ("admin_create_user", "Admin created user"),
        ("admin_delete_user", "Admin deleted user"),
        ("admin_delete_content", "Admin deleted content"),
        ("export_users", "Exported users"),
        ("export_activity", "Exported activity"),
        ("export_searches", "Exported user search data"),
        ("admin_ai_provider", "Admin changed AI provider"),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="activity_logs")
    action = models.CharField(max_length=40, choices=ACTIONS)
    description = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"]), models.Index(fields=["action", "created_at"])]

    def __str__(self):
        return f"{self.action} - {self.user or 'anonymous'}"


class UserBudget(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budget")
    cost_limit_usd = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.00"))
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}: ${self.cost_limit_usd}"
