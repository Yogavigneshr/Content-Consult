from django.db import models
from django.conf import settings
from sites_app.models import Site

class GeneratedContent(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("approved", "Approved"),
    ]

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="contents")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="generated_contents")
    content_type = models.CharField(max_length=80, default="blog")
    topic = models.CharField(max_length=500)
    tone = models.CharField(max_length=100, default="professional")
    word_count = models.PositiveIntegerField(default=800)
    title = models.CharField(max_length=500)
    body = models.TextField()
    # Free-form: not restricted to a fixed choice list, so the AI (or a
    # merchant) can set any category / sub-category a product needs.
    category = models.CharField(max_length=200, blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    seo_description = models.TextField(blank=True)
    keywords = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
