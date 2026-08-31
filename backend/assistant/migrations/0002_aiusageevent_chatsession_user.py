from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("assistant", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="chatsession",
            name="user",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_sessions", to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name="AIUsageEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("feature", models.CharField(choices=[("chat", "Chat"), ("content_generation", "Content generation")], max_length=40)),
                ("provider", models.CharField(max_length=40)),
                ("model", models.CharField(max_length=120)),
                ("api_calls", models.PositiveIntegerField(default=1)),
                ("input_tokens", models.PositiveBigIntegerField(default=0)),
                ("output_tokens", models.PositiveBigIntegerField(default=0)),
                ("total_tokens", models.PositiveBigIntegerField(default=0)),
                ("cost_usd", models.DecimalField(decimal_places=8, default=0, max_digits=14)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="usage_events", to="assistant.chatsession")),
                ("site", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_usage_events", to="sites_app.site")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_usage_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["feature", "created_at"], name="assistant_a_feature_8f2f77_idx"),
                    models.Index(fields=["session", "created_at"], name="assistant_a_session__a6e7d4_idx"),
                    models.Index(fields=["provider", "model", "created_at"], name="assistant_a_provide_6b2f2a_idx"),
                ],
            },
        ),
    ]
