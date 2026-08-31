from django.urls import path

from .views import ChatHistoryView, ChatView

urlpatterns = [
    path("chat/", ChatView.as_view(), name="assistant-chat"),
    path("history/<uuid:session_id>/", ChatHistoryView.as_view(), name="assistant-history"),
]
