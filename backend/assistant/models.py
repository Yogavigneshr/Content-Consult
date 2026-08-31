import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="chat_sessions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_page_url = models.URLField(blank=True, max_length=2048)
    last_page_title = models.CharField(blank=True, max_length=500)

    def __str__(self):
        return f"ChatSession({self.id})"


class ChatMessage(models.Model):
    ROLE_CHOICES = (("user", "User"), ("model", "Model"))
    session = models.ForeignKey(ChatSession, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class AIUsageEvent(models.Model):
    """One billable AI generation event, aggregated across provider retries."""
    FEATURE_CHOICES = (("chat", "Chat"), ("content_generation", "Content generation"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="ai_usage_events")
    session = models.ForeignKey(ChatSession, null=True, blank=True, on_delete=models.SET_NULL, related_name="usage_events")
    site = models.ForeignKey("sites_app.Site", null=True, blank=True, on_delete=models.SET_NULL, related_name="ai_usage_events")
    feature = models.CharField(max_length=40, choices=FEATURE_CHOICES)
    provider = models.CharField(max_length=40)
    model = models.CharField(max_length=120)
    api_calls = models.PositiveIntegerField(default=1)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)
    total_tokens = models.PositiveBigIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=14, decimal_places=8, default=Decimal("0"))
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["feature", "created_at"]),
            models.Index(fields=["session", "created_at"]),
            models.Index(fields=["provider", "model", "created_at"]),
        ]

    def __str__(self):
        return f"{self.feature}:{self.provider}:{self.model}:{self.cost_usd}"
