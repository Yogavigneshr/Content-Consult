from rest_framework import serializers


class PageContextSerializer(serializers.Serializer):
    """What the widget scrapes from the host page for grounding."""

    url = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    title = serializers.CharField(required=False, allow_blank=True, max_length=500)
    description = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    # Truncated, cleaned visible text of the page (or a specific
    # container the site owner wants used as context).
    content = serializers.CharField(required=False, allow_blank=True, max_length=20000)


class ChatRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField(required=False, allow_null=True)
    message = serializers.CharField(max_length=4000, trim_whitespace=True)
    page_context = PageContextSerializer(required=False)

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.CharField()
    content = serializers.CharField()
    created_at = serializers.DateTimeField()
