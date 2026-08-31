from django.urls import path
from .views import GenerateView, GenerateProductView, ContentHistoryView, SiteListView, DraftView, DraftExportView, HealthView, ProviderCatalogView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("providers/", ProviderCatalogView.as_view()),
    path("generate/", GenerateView.as_view()),
    path("generate-product/", GenerateProductView.as_view()),
    path("history/", ContentHistoryView.as_view()),
    path("sites/", SiteListView.as_view()),
    path("drafts/", DraftView.as_view()),
    path("drafts/<int:draft_id>/<str:fmt>/", DraftExportView.as_view()),
]
