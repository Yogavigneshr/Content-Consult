from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="ActivityLog", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("action", models.CharField(choices=[("login","Login"),("logout","Logout"),("generate","Generate content"),("save_draft","Save draft"),("chat","AI chat"),("admin_create_user","Admin created user"),("admin_delete_user","Admin deleted user"),("export_users","Exported users"),("export_activity","Exported activity"),("export_searches","Exported user search data")], max_length=40)),
        ("description", models.CharField(blank=True, max_length=500)),
        ("metadata", models.JSONField(blank=True, default=dict)),
        ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
        ("created_at", models.DateTimeField(auto_now_add=True)),
        ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activity_logs", to=settings.AUTH_USER_MODEL)),
    ], options={"ordering":["-created_at"], "indexes":[models.Index(fields=["user","created_at"], name="accounts_act_user_id_8b2c4b_idx"), models.Index(fields=["action","created_at"], name="accounts_act_action_1bb3d4_idx")]})]
