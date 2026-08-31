from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


def create_default_budgets(apps, schema_editor):
    UserBudget = apps.get_model('accounts', 'UserBudget')
    User = apps.get_model(settings.AUTH_USER_MODEL.split('.')[0], settings.AUTH_USER_MODEL.split('.')[1])
    UserBudget.objects.bulk_create([
        UserBudget(user_id=user.id, cost_limit_usd=Decimal('10.00'))
        for user in User.objects.filter(is_staff=False)
    ], ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [('accounts', '0002_activitylog_admin_ai_provider')]
    operations = [
        migrations.CreateModel(
            name='UserBudget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cost_limit_usd', models.DecimalField(decimal_places=4, default=Decimal('10.00'), max_digits=12)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=models.CASCADE, related_name='budget', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RunPython(create_default_budgets, migrations.RunPython.noop),
    ]
