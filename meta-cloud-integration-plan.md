# Meta Cloud API integration plan

## Objectives
- Expose WhatsApp Cloud API instances alongside current Baileys powered Evolution instances.
- Reuse the `app-meta` submodule to manage OAuth, Meta asset synchronization, and permanent access tokens.
- Enforce Meta conversation window rules (template requirement outside the 24-hour service window).
- Support official Meta interactive message types (starting with buttons).
- Keep the architecture extensible so other projects can reuse the same integration path.

## System architecture overview

### Existing state
- `api-disparador` backend is a Spring Boot application that talks to Evolution API (Baileys) through `EvolutionApiClient`.
- Campaign delivery, automations, and bots all assume Baileys-style messaging.
- `EvolutionConfig` JPA entity stores one configuration per Evolution instance (base URL, API key, instance name).
- Frontend (React) surfaces `/settings?tab=evolution` for administrators.
- `app-meta` is a NestJS + Next.js monorepo that:
  - completes Meta OAuth (including embedded signup),
  - exchanges tokens for long-lived tokens,
  - stores phone number credentials encrypted (Prisma/Postgres),
  - exposes `/api/credentials/:companyId` protected via JWT or API key.

### Target state
- `EvolutionConfig` differentiates between `BAILEYS` and `CLOUD_OFFICIAL` providers.
- New entity (or extended schema) keeps pointers to `app-meta` credential records (phoneNumberId, businessId, credentialId, display phone).
- Each company in `api-disparador` stores the `app-meta` company identifier and an API key used to query credentials.
- Backend introduces a `MetaProviderClient` responsible for:
  - calling `app-meta` external API,
  - caching/encrypting tokens locally,
  - keeping track of token expiration,
  - initiating token refresh / resync flows when needed.
- Backend adds a `MetaWhatsappClient` that sends messages via Meta Graph API:
  - template sending (business initiated),
  - session messages (within 24h),
  - interactive buttons.
- Conversation window enforcement checks:
  - if a valid customer service window (within last 24h inbound) exists via Graph `/phone_number_id/conversations`,
  - otherwise requires a selected approved template.
- Campaign pipeline chooses the correct transport:
  - Baileys flow stays untouched.
  - Meta flow prepares payloads according to template/message kind and uses `MetaWhatsappClient`.
- Frontend updates `/settings?tab=evolution` with:
  - synchronization status for app-meta credentials,
  - ability to create an Evolution Cloud instance from a Meta credential,
  - visualization of template catalogue pulled from app-meta / Meta.
- Campaign Form adapts:
  - selection of provider per instance,
  - template picker for Meta campaigns,
  - validation messaging regarding conversation windows.
- Automations/bots ensure provider awareness (cannot assume QR codes).

## Required backend changes (`api-disparador`)

1. **Data model**
   - Add enum `EvolutionProviderType` (`BAILEYS`, `CLOUD_OFFICIAL`).
   - Extend `EvolutionConfig` with provider type and Meta specific columns:
     - `metaCredentialExternalId` (string, references `app-meta` credential id).
     - `metaPhoneNumberId`, `metaBusinessId`, `metaDisplayPhone`, `metaVerifiedName`.
     - `metaTokenEncrypted`, `metaTokenExpiresAt`.
   - Link `Company` to `app-meta`:
     - `metaProviderCompanyId` (string).
     - `metaProviderApiKey` (encrypted).
   - Create Flyway migration(s) covering the new columns + defaults.

2. **Integration services**
   - `MetaProviderClient`: wraps HTTP calls to `app-meta`, handling retries and authentication.
   - `MetaCredentialService`: sync credentials from `app-meta`, persist encrypted tokens if opted-in, expose list to other modules.
   - `MetaWhatsappClient`: wraps Graph API operations (send text, send template, send buttons) and conversation lookup.
   - `MetaConversationWindowService`: determines if the 24h window is open; caches results to avoid rate limiting.

3. **Evolution orchestration**
   - Extend `EvolutionConfigService` to create/delete Evolution Cloud instances via official endpoints (`/instance/create/meta` or equivalent).
   - Ensure generated instance names stay unique (e.g., slugify phone number).
   - Store association between Evolution instance and Meta credential.

4. **Campaign & queue pipeline**
   - Update `MessageProcessor` and related services to branch per provider type.
   - Introduce template payload builder (leverages campaign content or selected template).
   - Add support for interactive button payloads (structure matching Meta API requirements).
   - Ensure preventive analysis consults Meta conversation statuses instead of Baileys chat history when provider is Meta.

5. **API surface**
   - New endpoints under `/api/meta` (or extend existing) for:
     - linking a company to `app-meta` (store API key/id),
     - triggering credential sync,
     - listing available Meta credentials,
     - listing approved templates (per phone number).
   - Extend Evolution endpoints to include provider metadata in responses.

6. **Security**
   - Reuse existing encryption utilities to store Meta tokens and API keys.
   - Sanitize logging to avoid leaking tokens.
   - Rate limit integration endpoints to protect against abuse.

## Required frontend changes (`frontend`)

1. **Settings / Evolution tab**
   - Display both Baileys and Meta instances with provider badges.
   - Provide CTA to connect to app-meta (launch OAuth flow in new window).
   - Allow selecting a Meta credential and provisioning an Evolution instance.
   - Surface token/expiration status and resync actions.

2. **Campaign creation**
   - When a Meta instance is selected:
     - Show conversation window status (checking via backend).
     - Require template selection if window closed; allow session message otherwise.
     - Provide template selector with search and variable preview.
     - Support button creation UI aligned with Meta payload structure.

3. **Automations / Bots**
   - Filter features that are incompatible with Meta (e.g., QR flow).
   - Provide warnings when selecting Meta instances for unsupported features.

4. **Shared utilities**
   - Update `EvolutionConfig` types to include `providerType`, Meta fields.
   - Adjust `evolutionService` and `adminService` calls to handle new endpoints.
   - Add new `metaService` wrapper for `app-meta` aware endpoints.

## Required changes inside `app-meta`

1. **Permanent token workflow**
   - Confirm long-lived exchange already implemented; add support to generate permanent tokens:
     - Documented by Evolution: create system user and long-lived system user token linked to business.
     - Provide background job or endpoint to refresh / regenerate tokens automatically.
   - Store both raw token and metadata (type, issuedAt) to help downstream consumers.

2. **External API extensions**
   - Expose template catalogue for each credential (fetch via Graph `/business/registered_whatsapp_message_templates`).
   - Provide conversation window helper endpoint if feasible (optional).
   - Allow filtering credentials by status / phone number.

3. **Webhook parity**
   - Ensure message webhooks are persisted so conversation window checks can be cross-validated (future improvements).

4. **Docs**
   - Document the contract expected by `api-disparador` (credentials payload, template shape).

## Testing strategy

- Unit and integration tests for new clients (mock Graph API/app-meta).
- Flyway migration verification + backward compatibility for existing Baileys records.
- End-to-end smoke tests:
  - Sync credential from app-meta.
  - Provision Evolution Cloud instance.
  - Send template message (outside 24h).
  - Send session message with buttons (within 24h).
- Frontend e2e (Playwright/Cypress) to cover UI flows.

## Outstanding questions

- Exact Evolution API endpoints for Cloud instance provisioning (confirm with latest docs).
- Whether to cache Meta tokens locally or fetch on demand from app-meta for every send (trade-off security vs latency).
- Source of template list: should `api-disparador` proxy Graph or rely solely on app-meta?
- Long-term webhook storage: will `api-disparador` also subscribe to Meta webhooks or reuse app-meta?

