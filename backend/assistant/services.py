"""Provider-neutral AI chat service with admin-controlled provider and usage accounting."""

import logging

from django.conf import settings
from google.genai import types
from google.genai.errors import APIError

from content.ai import _provider_config, _provider_cost

logger = logging.getLogger(__name__)


def build_system_instruction(page_context: dict | None) -> str:
    base = (
        "You are a helpful assistant embedded directly on a website, "
        "answering questions for a visitor who is currently looking at "
        "the page described below. Prefer information from the page "
        "context when it's relevant. If the visitor asks something the "
        "page context doesn't cover, answer from general knowledge but "
        "say so briefly. Be concise, friendly, and avoid repeating the "
        "page context back verbatim unless asked to summarize it."
    )
    if not page_context:
        return base
    url = page_context.get("url", "")
    title = page_context.get("title", "")
    description = page_context.get("description", "")
    content = page_context.get("content", "")[: settings.MAX_CONTEXT_CHARS]
    context_block = "\n\n---\nCURRENT PAGE CONTEXT\n"
    if url: context_block += f"URL: {url}\n"
    if title: context_block += f"Title: {title}\n"
    if description: context_block += f"Description: {description}\n"
    if content: context_block += f"Visible content (may be truncated):\n{content}\n"
    context_block += "---"
    return base + context_block


def _history_text(history_messages, user_message):
    lines = []
    for message in history_messages:
        role = "Assistant" if message.role == "model" else "Visitor"
        lines.append(f"{role}: {message.content}")
    lines.append(f"Visitor: {user_message}")
    return "\n\n".join(lines)


def _usage_counts(usage_obj):
    if not usage_obj:
        return 0, 0
    input_tokens = int(getattr(usage_obj, "input_tokens", getattr(usage_obj, "prompt_token_count", 0)) or 0)
    output_tokens = int(getattr(usage_obj, "output_tokens", getattr(usage_obj, "candidates_token_count", 0)) or 0)
    return input_tokens, output_tokens


def generate_reply(*, history_messages, user_message: str, page_context: dict | None):
    selected, key, model, temperature, max_tokens, system_instruction = _provider_config(None)
    prompt = _history_text(history_messages, user_message)

    if selected == "gemini":
        from content.ai import _gemini_client
        client = _gemini_client(key)
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=build_system_instruction(page_context),
                    temperature=temperature,
                    max_output_tokens=min(max_tokens, 2048),
                ),
            )
        except APIError:
            logger.exception("Gemini API call failed")
            raise
        text = getattr(response, "text", None)
        input_tokens, output_tokens = _usage_counts(getattr(response, "usage_metadata", None))
    elif selected == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=key)
        response = client.responses.create(
            model=model,
            instructions=build_system_instruction(page_context),
            input=prompt,
            max_output_tokens=min(max_tokens, 2048),
        )
        text = getattr(response, "output_text", None)
        input_tokens, output_tokens = _usage_counts(getattr(response, "usage", None))
    else:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        response = client.messages.create(
            model=model,
            system=build_system_instruction(page_context),
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=min(max_tokens, 2048),
        )
        text = "".join(getattr(block, "text", "") for block in response.content if getattr(block, "type", "") == "text")
        input_tokens, output_tokens = _usage_counts(getattr(response, "usage", None))

    if not text:
        raise RuntimeError(f"{selected} returned an empty response.")
    return text, {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "provider": selected,
        "model": model,
        "api_calls": 1,
        "cost_usd": _provider_cost(selected, input_tokens, output_tokens),
    }
