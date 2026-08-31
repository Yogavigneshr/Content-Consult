from django.contrib import admin

from .models import AIProviderConfig, AIPlatformSettings, AISettings, Site


class AISettingsInline(admin.StackedInline):
    model = AISettings
    extra = 1
    max_num = 1
    fields = (
        "provider",
        "model",
        "temperature",
        "max_output_tokens",
        "system_prompt",
    )


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("name", "domain", "api_key", "language", "created_at")
    readonly_fields = ("api_key", "created_at")
    search_fields = ("name", "domain")
    fieldsets = (
        (
            "Site details",
            {
                "fields": (
                    "name",
                    "domain",
                    "api_key",
                    "language",
                    "brand_voice",
                    "content_rules",
                    "created_at",
                )
            },
        ),
    )
    inlines = [AISettingsInline]


@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    list_display = (
        "site",
        "provider",
        "model",
        "temperature",
        "max_output_tokens",
    )
    list_filter = ("provider", "model")


@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("provider", "model", "configured", "updated_at")
    readonly_fields = ("configured", "updated_at")
    exclude = ("encrypted_api_key",)

@admin.register(AIPlatformSettings)
class AIPlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ("active_provider", "updated_at")
