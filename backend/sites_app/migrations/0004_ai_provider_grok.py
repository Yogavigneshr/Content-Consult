from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("sites_app", "0003_aiproviderconfig_aiplatformsettings")]
    operations = [migrations.AlterField(
        model_name="aiproviderconfig",
        name="provider",
        field=models.CharField(choices=[("gemini", "Gemini"), ("openai", "ChatGPT / OpenAI"), ("anthropic", "Claude"), ("xai", "Grok / xAI")], max_length=30, unique=True),
    )]
