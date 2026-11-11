# AI model cost comparison for chat and job matching

**Research checked:** 2026-11-10  
**Scope:** Public first-party model, pricing, API, and rate-limit documentation only. Prices below are USD per million tokens unless noted; provider pricing and quotas can change.

## Recommendation

Keep conversational help and job matching as separate workloads. For concise, role-aware chat replies, evaluate **OpenAI GPT-5 nano** first: its listed standard token price is the lowest in this comparison. Use schema-constrained output only after confirming the chosen model supports the required schema/features. For matching, retain deterministic eligibility filters and ranking as the source of truth; optionally use an embedding service for retrieval and a small generation call only to explain a short list of results. Do not send full resume/job corpora to a chat model for pairwise scoring. OpenAI and Google document embedding APIs, but the reviewed official materials did not establish an exact embedding price and limits suitable for a complete cost comparison; verify those before selecting a matching provider. [OpenAI pricing](https://developers.openai.com/api/docs/pricing) · [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) · [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings) · [Google embeddings](https://ai.google.dev/gemini-api/docs/embeddings)

## Conversational generation options

| Provider / model | Standard input / output price | Relevant API features and caveats |
|---|---:|---|
| OpenAI **GPT-5 nano** | **$0.05 / $0.40** | OpenAI documents JSON Schema structured outputs. Confirm compatibility for the selected model and schema before depending on constrained output. [Pricing](https://developers.openai.com/api/docs/pricing) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) |
| Anthropic **Haiku 5.5** | **$0.10 / $0.50** for prompts up to 100K tokens; **$0.50 / $2.50** above 100K | Anthropic documents structured JSON output and strict tool use for Haiku 5.5. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Google **Gemini 4 Argon** | **$2 / $10** through 2026-11-30; listed as **$4 / $20** effective 2026-12-01 | Google documents JSON Schema structured output. Its listed price is substantially higher than the other compared generation options. [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Structured output](https://ai.google.dev/gemini-api/docs/structured-output) |

These are provider-listed standard token prices, not an estimate of total deployed cost. Prompt length, output length, caching, batching, provider tier, and any API reseller can change the bill; the repository currently uses OpenRouter, so these first-party prices are not necessarily its effective rates. Check the linked pricing pages and actual serving provider rates before deployment.

## Matching-specific options and limits

- **OpenAI embeddings:** The official guide describes embeddings for semantic search and relatedness. The reviewed official material did not establish an exact current embedding price or a model input limit, so no complete unit-cost comparison is claimed here. [Embeddings guide](https://developers.openai.com/api/docs/guides/embeddings)
- **Google embeddings:** The official guide lists `gemini-embedding-001` (text-only) and `gemini-embedding-2` (multimodal), with semantic search among the described applications. Exact embedding price and applicable limits were not verified in the reviewed pricing material. [Embeddings guide](https://ai.google.dev/gemini-api/docs/embeddings)
- **Anthropic:** No first-party embedding model or embedding price was verified in the reviewed sources. Do not assume its generation prices apply to embeddings.
- **Rate limits:** OpenAI limits vary by model and usage tier; check the organization’s Limits page for active quotas. [OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits) Google documents RPM, input TPM, and RPD limits that vary by model and project tier, and directs users to AI Studio for current limits. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) Anthropic lists Haiku 5.5 Start-tier limits of **4,000 RPM, 2,000,000 input tokens/minute, and 400,000 output tokens/minute**; actual quotas depend on organization tier. [Anthropic rate limits](https://platform.claude.com/docs/en/api/rate-limits)

## Architecture fit for this repository

The existing design already separates help from matching: one shared OpenAI-compatible provider layer serves both, while deterministic matching runs first and the optional model pass reranks only the deterministic top 30. The current ranking uses skills, barangay, preferred-position title words, and recency; provider failure falls back to deterministic results. The ADR explicitly says matching uses no embeddings or semantic similarity. See [ADR-041](rework/08-ai-provider-and-matching.md): `docs/arch/rework/08-ai-provider-and-matching.md:24-50, 52-108, 110-132, 185-187`.

The existing job-match call is not resume-to-job semantic matching: the ADR says its payload includes typed preference text and public job fields, and excludes seeker identity, profile row, resume, and application data (`docs/arch/rework/08-ai-provider-and-matching.md:133-147`). Help is another distinct workload; its role-aware scope is recorded in [ADR-023](rework/07-ai-help-chat.md) (`docs/arch/rework/07-ai-help-chat.md:3-10`), with the shared-provider budget at `docs/arch/rework/08-ai-provider-and-matching.md:160-161`.

**Recommended path:**

1. Keep eligibility and ranking deterministic, with an explicit reason for every match.
2. Keep help generation concise and measure its usage as a chat workload. The current provider budget is shared with matching, not independently allocated; GPT-5 nano is the price-first candidate among the compared models, subject to the actual serving provider's rates. Benchmark answer quality and verify model-specific structured-output support before adopting.
3. If future product requirements call for resume/job semantic retrieval, first define what resume data may leave the service and for what retention/training terms; then compare embedding cost, input limits, and project quotas from current provider documentation. Precompute and cache vectors rather than re-embedding each query.
4. Retrieve/filter a small eligible candidate set before optional model reranking or explanation. Keep model prose advisory, not an eligibility decision or an asserted fact.

## Sources and date

All provider links above point to official provider documentation. Pricing and feature claims were checked 2026-11-10; recheck linked pages and account-specific quota dashboards before procurement or production configuration.
