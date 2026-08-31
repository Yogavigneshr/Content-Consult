from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="generatedcontent",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
