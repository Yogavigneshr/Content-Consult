from rest_framework import serializers

from .models import GeneratedContent


class GenerateSerializer(serializers.Serializer):
    content_type = serializers.CharField(max_length=80, default="blog")
    topic = serializers.CharField(max_length=1000)
    tone = serializers.CharField(max_length=100, default="professional")
    word_count = serializers.IntegerField(min_value=30, max_value=10000, default=800)
    action = serializers.CharField(max_length=40, default="generate")
    selected_text = serializers.CharField(required=False, allow_blank=True, default="")
    context = serializers.JSONField(required=False, default=dict)
    provider = serializers.ChoiceField(choices=["gemini", "openai", "anthropic"], required=False, default="gemini")


class GenerateProductSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=1000)
    tone = serializers.CharField(max_length=100, default="professional")
    word_count = serializers.IntegerField(min_value=50, max_value=10000, default=300)
    existing_title = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    existing_category = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    existing_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, default=None)
    provider = serializers.ChoiceField(choices=["gemini", "openai", "anthropic"], required=False, default="gemini")


class GeneratedContentSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, allow_null=True)

    class Meta:
        model = GeneratedContent
        fields = [
            "id", "site", "site_name", "content_type", "topic", "tone",
            "word_count", "title", "body", "category", "price",
            "seo_description", "keywords", "metadata", "created_by", "created_by_username", "status", "created_at",
        ]
