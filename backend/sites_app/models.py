import base64
import hashlib
import secrets

from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet, InvalidToken


class Site(models.Model):
    name=models.CharField(max_length=150)
    domain=models.CharField(max_length=255, unique=True)
    api_key=models.CharField(max_length=80, unique=True, editable=False)
    brand_voice=models.CharField(max_length=255, blank=True)
    language=models.CharField(max_length=80, default='English')
    content_rules=models.TextField(blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    def save(self,*args,**kwargs):
        if not self.api_key: self.api_key='cgp_'+secrets.token_urlsafe(32)
        super().save(*args,**kwargs)
    def __str__(self): return self.name


class AISettings(models.Model):
    site=models.OneToOneField(Site,on_delete=models.CASCADE,related_name='ai_settings')
    provider=models.CharField(max_length=50,default='gemini')
    model=models.CharField(max_length=100,default='gemini-3.6-flash')
    temperature=models.FloatField(default=0.7)
    max_output_tokens=models.PositiveIntegerField(default=4096)
    system_prompt=models.TextField(blank=True)
    def __str__(self): return f'{self.site.name} - {self.model}'


class AIProviderConfig(models.Model):
    PROVIDER_CHOICES = (
        ('gemini', 'Gemini'),
        ('openai', 'ChatGPT / OpenAI'),
        ('anthropic', 'Claude'),
        ('xai', 'Grok / xAI'),
    )
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, unique=True)
    encrypted_api_key = models.TextField(blank=True, default='')
    model = models.CharField(max_length=120, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['provider']

    @staticmethod
    def _fernet():
        secret = str(settings.SECRET_KEY).encode('utf-8')
        digest = hashlib.sha256(secret).digest()
        return Fernet(base64.urlsafe_b64encode(digest))

    def set_api_key(self, value):
        value = (value or '').strip()
        self.encrypted_api_key = self._fernet().encrypt(value.encode('utf-8')).decode('utf-8') if value else ''

    def get_api_key(self):
        if not self.encrypted_api_key:
            return ''
        try:
            return self._fernet().decrypt(self.encrypted_api_key.encode('utf-8')).decode('utf-8')
        except (InvalidToken, ValueError, TypeError):
            return ''

    @property
    def configured(self):
        return bool(self.encrypted_api_key)

    def __str__(self):
        return self.get_provider_display()


class AIPlatformSettings(models.Model):
    """Singleton controlling which configured provider all user AI requests use."""
    active_provider = models.CharField(max_length=30, default='gemini')
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create(active_provider='gemini')
        return obj

    def __str__(self):
        return f'Content Consult AI: {self.active_provider}'
