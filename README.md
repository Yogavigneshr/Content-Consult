# Niftybot Content Copilot

Niftybot is an embedded AI content-generation widget built with React + Vite and Django REST Framework. It supports Gemini, ChatGPT/OpenAI, and Claude/Anthropic as selectable generation providers.

It is **not limited to product descriptions**. The same widget can generate and transform:

- Product listings
- Blog articles
- Landing pages
- Social posts
- Marketing emails
- Ad copy
- Newsletters
- Press releases

It can also improve, rewrite, shorten, expand, SEO-optimize, convert to bullets, or translate existing text.

## 1. Backend

```text
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

For local development, set `GEMINI_API_KEY` in `.env`. For Google Compute Engine deployment, use the Vertex AI/ADC configuration below instead. OpenAI and Anthropic keys can also be configured as server-side fallbacks. In the Content Studio, users can instead select ChatGPT/OpenAI or Claude/Anthropic and enter their own provider key; those user keys are kept in the browser and are not stored in the database.

```text
python manage.py migrate
python manage.py runserver
```

### Automatic local setup

Niftybot automatically creates its first local Site when the frontend starts. You do not need to open Django admin.

Niftybot is multi-site. **Do not use the dashboard until at least one Site exists.**

1. Start Django:
   ```text
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```
3. Open **Sites → Add Site**.
4. Enter the site's **name** and **domain**. Brand voice, language, content rules, and AI settings are optional.
5. Save the Site. Django automatically generates its unique `cgp_...` API key.
6. Refresh the Content Studio. The newly created Site is selected automatically.

The dashboard now shows a setup screen instead of silently assuming `site_id=1`. For embedded sites, pass that Site's API key using the `X-API-Key` header.

## 2. Dashboard

```text
cd frontend
npm install
npm run dev
```

The dashboard demonstrates the same reusable widget inside the editor and as a floating launcher.

## 3. Build the universal embed

```text
npm run build:embed
```

This creates:

```text
frontend/dist/embed.js
```

Host that file on your CDN/static host.

## 4. Embed on any website

Copy the configuration from `frontend/EMBED_SNIPPET.html` into the host page before loading `embed.js`.

The important part is that **one embed works across all content editors**. Change only:

```js
contentType: "product"
```

to:

```text
blog
landing_page
social_post
email
ad_copy
newsletter
press_release
```

For automatic insertion into an existing editor, provide CSS selectors such as:

```js
targetTitleSelector: "#title",
targetSelector: "#body",
targetCategorySelector: "#category",
targetPriceSelector: "#price",
targetSeoSelector: "#seo-description"
```

Niftybot will update normal inputs/textareas/contenteditable fields and dispatch `input`/`change` events so common React/Vue/vanilla forms can detect the change.

## 5. Optional chat mode

The original page-question assistant is still available. Set:

```js
mode: "chat"
```

to use it instead of the content-generation copilot.

## API

Universal generation:

```text
POST /api/v1/generate/
```

Accepts:

```json
{
  "site_id": 1,
  "content_type": "blog",
  "topic": "10 ways to improve customer retention",
  "tone": "professional",
  "word_count": 800,
  "action": "generate",
  "selected_text": "",
  "context": {}
}
```

The response contains `title`, `body`, `category`, `price`, `seo_description`, and `keywords`.

Product generation remains available at `/api/v1/generate-product/` for backward compatibility.


## AI cost and latency safeguards

- Generation uses compact, content-type-specific JSON schemas instead of one large universal response schema.
- Generate requests do not send editor/page context unless it is needed for an edit action.
- Output-token budgets are capped by content type to avoid oversized completions.
- Exact repeated requests are cached for 30 minutes on the backend and for the current browser session.
- Apply and Save Draft do not call the AI provider.
- Gemini remains the default low-cost provider when configured; provider keys stay server-side.

## Google Cloud Gemini / Vertex AI

This project already uses the `google-genai` SDK. For deployment on a Google Compute Engine VM, Gemini can use Vertex AI with Application Default Credentials (ADC), so no Gemini API key needs to be stored in the application.

Set these backend environment variables:

```text
GEMINI_USE_VERTEX_AI=True
GOOGLE_CLOUD_PROJECT=contentconsult
GOOGLE_CLOUD_LOCATION=us-central1
```

Then enable the Vertex AI API for the project:

```bash
gcloud config set project contentconsult
gcloud services enable aiplatform.googleapis.com
```

The VM's attached service account must have permission to use Vertex AI. The Django backend calls Gemini; the React frontend continues to call the existing `/api/generate/` endpoint. Do not put Google credentials in frontend code.

For local development, leave `GEMINI_USE_VERTEX_AI=False` and configure `GEMINI_API_KEY` instead.


### Verify Vertex AI on the VM

After configuring the VM service account and environment variables, run from `backend`:

```bash
python verify_vertex_ai.py
```

A successful run prints the configured project/location and a short Gemini response. The script uses the same client configuration as Content Consult, so it is a safe way to verify ADC + Vertex AI before testing the browser UI.

For a Compute Engine deployment, do not put a service-account JSON file or Gemini credential in the React frontend.
