from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="activitylog",
            name="action",
            field=models.CharField(
                max_length=40,
                choices=[
                    ("login", "Login"), ("logout", "Logout"),
                    ("generate", "Generate content"), ("save_draft", "Save draft"),
                    ("chat", "AI chat"), ("admin_create_user", "Admin created user"),
                    ("admin_delete_user", "Admin deleted user"), ("admin_delete_content", "Admin deleted content"),
                    ("export_users", "Exported users"), ("export_activity", "Exported activity"),
                    ("export_searches", "Exported user search data"),
                    ("admin_ai_provider", "Admin changed AI provider"),
                ],
            ),
        ),
    ]
