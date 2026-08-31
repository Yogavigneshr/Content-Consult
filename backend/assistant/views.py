import logging

from google.genai.errors import APIError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from accounts.services import log_activity, enforce_user_budget

from .models import AIUsageEvent, ChatMessage, ChatSession
from .serializers import ChatMessageSerializer, ChatRequestSerializer
from .services import generate_reply

logger = logging.getLogger(__name__)

# How many prior turns to send back to Gemini as history. Keeps latency
# and token cost bounded on long-running conversations.
MAX_HISTORY_MESSAGES = 20


class ChatView(APIView):
    permission_classes = [IsAuthenticated]
    """POST /api/assistant/chat/

    Body:
        {
          "session_id": "<uuid, optional>",
          "message": "user's message",
          "page_context": {"url": "...", "title": "...", "description": "...", "content": "..."}
        }

    Returns:
        {
          "session_id": "<uuid>",
          "reply": "model's reply text"
        }
    """

    def post(self, request):
        enforce_user_budget(request.user)
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session_id = data.get("session_id")
        page_context = data.get("page_context") or {}

        session = None
        if session_id:
            session = ChatSession.objects.filter(id=session_id).first()
            if session is not None and session.user_id not in (None, request.user.id):
                session = None
        if session is None:
            session = ChatSession.objects.create(user=request.user)
        elif session.user_id is None:
            session.user = request.user
            session.save(update_fields=["user"])

        if page_context.get("url"):
            session.last_page_url = page_context["url"]
        if page_context.get("title"):
            session.last_page_title = page_context["title"]
        session.save(update_fields=["last_page_url", "last_page_title", "updated_at"])

        history = list(
            session.messages.order_by("-created_at")[:MAX_HISTORY_MESSAGES]
        )[::-1]

        user_message = data["message"]

        try:
            reply_text, usage = generate_reply(
                history_messages=history,
                user_message=user_message,
                page_context=page_context,
            )
        except APIError as exc:
            logger.error("Gemini API error: %s", exc)
            return Response(
                {"error": "The assistant is temporarily unavailable. Please try again shortly."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except RuntimeError as exc:
            logger.error("Assistant configuration error: %s", exc)
            return Response(
                {"error": "The assistant is not configured correctly."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        ChatMessage.objects.create(session=session, role="user", content=user_message)
        ChatMessage.objects.create(session=session, role="model", content=reply_text)
        AIUsageEvent.objects.create(
            user=request.user, session=session, feature="chat",
            provider=usage.get("provider", "gemini"), model=usage.get("model", ""),
            api_calls=int(usage.get("api_calls", 1) or 1),
            input_tokens=int(usage.get("input_tokens", 0) or 0),
            output_tokens=int(usage.get("output_tokens", 0) or 0),
            total_tokens=int(usage.get("total_tokens", 0) or 0),
            cost_usd=usage.get("cost_usd", 0),
            metadata={"page_url": page_context.get("url", "") if page_context else ""},
        )
        log_activity(request.user, "chat", f"AI chat: {user_message[:120]}", {"session_id": str(session.id)}, request)

        return Response(
            {"session_id": str(session.id), "reply": reply_text, "usage": {
                "api_calls": usage.get("api_calls", 1),
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "cost_usd": str(usage.get("cost_usd", 0)),
                "provider": usage.get("provider", ""),
                "model": usage.get("model", ""),
            }},
            status=status.HTTP_200_OK,
        )


class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    """GET /api/assistant/history/<session_id>/

    Lets the widget rehydrate a conversation after a page refresh.
    """

    def get(self, request, session_id):
        session = ChatSession.objects.filter(id=session_id).first()
        if session is None:
            return Response({"messages": []}, status=status.HTTP_200_OK)

        messages = session.messages.order_by("created_at")
        serialized = ChatMessageSerializer(messages, many=True).data
        return Response({"messages": serialized}, status=status.HTTP_200_OK)
