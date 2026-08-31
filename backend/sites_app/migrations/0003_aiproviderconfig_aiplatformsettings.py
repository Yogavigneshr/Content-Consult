from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('sites_app', '0002_alter_aisettings_model')]
    operations = [
        migrations.CreateModel(
            name='AIProviderConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('gemini','Gemini'),('openai','ChatGPT / OpenAI'),('anthropic','Claude')], max_length=30, unique=True)),
                ('encrypted_api_key', models.TextField(blank=True, default='')),
                ('model', models.CharField(blank=True, default='', max_length=120)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering':['provider']},
        ),
        migrations.CreateModel(
            name='AIPlatformSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('active_provider', models.CharField(default='gemini', max_length=30)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
