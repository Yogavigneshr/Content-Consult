from django.contrib import admin
from .models import ActivityLog

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "description", "ip_address")
    list_filter = ("action", "created_at")
    search_fields = ("user__username", "user__email", "description")
    readonly_fields = ("created_at",)
