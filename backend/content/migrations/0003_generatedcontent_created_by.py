from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("content", "0002_generatedcontent_metadata"), ("accounts", "0001_initial")]
    operations = [migrations.AddField(model_name="generatedcontent", name="created_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="generated_contents", to=settings.AUTH_USER_MODEL))]
