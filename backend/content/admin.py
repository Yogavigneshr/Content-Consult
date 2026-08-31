from django.contrib import admin
from .models import GeneratedContent

@admin.register(GeneratedContent)
class GeneratedContentAdmin(admin.ModelAdmin):
    list_display = ("title", "site", "content_type", "status", "created_at")
    list_filter = ("status", "content_type", "site")
    search_fields = ("title", "topic", "body")
    readonly_fields = ("created_at",)
