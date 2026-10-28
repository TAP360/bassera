# Consumer identity login

The mobile app uses the existing Axios client in `utils/httpClient.ts` for
the external consumer identity service. Its owner-supplied base URL is
`https://nero.tap-360.com/`. The API base URL is fixed to this service. The business
code defaults to `neurowealth` and can be overridden with
`EXPO_PUBLIC_IDENTITY_BUSINESS_CODE`; these values are public configuration,
not credentials. Phone validation sends `{ countryCode, phone }`; the phone
OTP request sends `{ businessCode, phone, language }`.

## Flow

The original splash, introductory slides and onboarding sign-in appearance
are retained. `IdentityAuthForm` uses one Email or Mobile input. Phone mode
shows only the selected country abbreviation beside that same input, with
no separate calling-code field. The calling code is kept internally for API
requests. Explicit
international prefixes (`+` or `00`) are separated while typing, without
moving focus away from the identifier field. Full bare international numbers
are split only when they are valid and either not a possible local number or
already recognized as international by the phone parser. Local
numbers are not assigned arbitrary country prefixes. The searchable country
list includes all calling-code regions from libphonenumber metadata, with
English and Arabic country names. Shared calling codes remain selectable by
country; server-side phone validation remains authoritative.

Email OTP uses the supplied email request contract and the shared OTP
verification endpoint. Email is sent only to the email-specific request
endpoint; it is never sent in the phone field. Phone and email OTP both use
the same expiry, resend, session persistence, profile loading, and navigation
behavior. The legacy password register/login operations are not used by this
OTP flow.

Phone OTP verification returns **nested** tokens, or
`mfaRequired: true` plus userId. MFA is completed using POST
`/v1/identity/consumer/auth/mfa/challenge` with userId and totpCode, or POST
`/v1/identity/consumer/auth/mfa/recovery` with userId and recoveryCode. These
return **flat** token responses. Tokens and `/me` are never requested/persisted
before all required verification completes. Recovery codes are single-use,
managed by the backend. No registration resend or expiry endpoint/contract was
provided; the app does not invent one.

Passwords, verification codes and pending MFA/registration identifiers stay
ephemeral. Sensitive mutations are reset after each action; their inactive
cache retention is zero. Social buttons preserve the original appearance but
show an explicit unavailable message; no OAuth endpoints were supplied and
they cannot bypass authentication.

Phone flow:

1. POST `/v1/identity/consumer/auth/phone/validate` with `{ countryCode, phone }`.
   Only a `valid: true` response with a canonical `e164` number continues.
2. POST `/v1/identity/consumer/auth/otp/request` with
   `{ businessCode, phone, language }`, where `phone` is the validated E.164
   number. Language is also sent in the `Accept-Language` header.
   Resend uses this same endpoint. The UI honors server `expiresIn` and
   `resendAfter`, and never pre-fills or generates an OTP.
3. POST `/v1/identity/consumer/auth/otp/verify` with `{ businessCode, phone, otp }`.
4. A non-MFA response with a complete session saves both access and refresh
    tokens to the Zustand auth store in `stores/authStore.ts`, using Zustand `persist` with
    AES-256-GCM-encrypted AsyncStorage. Persistence is awaited before profile loading is enabled.
5. GET `/v1/identity/consumer/me` with the saved Bearer access token.
   The profile is cached in React Query under
    `["identity", "consumer", "me", userId]`. The full response is also saved
    in the encrypted auth snapshot, validated against the authenticated userId.
6. Protected routes open only after the profile loads successfully. Restoring
   a persisted session fetches `/me` again; a failure offers retry/sign-out.
7. When verification returns `newUser: true` (first sign-in by phone or email),
   an encrypted, persisted `surveyPending` flag is saved with the session and
   the user is routed to `/onboarding` (name step, then money-attitude survey).
   Home also redirects there while the flag is set, so the auth guard's
   automatic redirect or an app restart cannot skip the survey. Finishing the
   survey clears the flag. Returning users (`newUser: false`) go straight Home.

Email flow:

1. POST `/v1/identity/consumer/auth/otp/email/request` with
   `{ businessCode, email }`. The `Accept-Language` header carries the current
   language. Resend uses the same endpoint.
2. POST `/v1/identity/consumer/auth/otp/verify` with
   `{ businessCode, email, otp }`. The response follows the same nested-token
   or MFA contract as phone verification.
3. On successful verification, both tokens are durably saved, `/me` is loaded,
   and the user is routed to the authenticated app.

PUT `/v1/identity/consumer/me` accepts a partial `{ name, language, halalMode }`
update and returns the updated full profile. Personal Information and the
onboarding name step save names to this endpoint and update both the auth store and
React Query. Email and phone cannot be edited through PUT and are read-only.
The Profile toggles halal mode via the same endpoint, optimistically.

`useProfile()` (`hooks/useProfile.ts`) is the screen-facing GET
`/v1/identity/consumer/me` hook. It shares the session's React Query cache
entry (no duplicate request), shows the persisted auth-store profile as placeholder
data, parses the JSON-encoded `preferences` string, formats `createdAt` as
"member since", and merges device-only profile data (photo, money personality,
plan, scores) from the persisted Zustand app store (`stores/appStore.ts`). The
name falls back to a localized placeholder, never a fabricated identity.

### Preferences

`preferences` is a JSON-encoded string on the profile. The app manages
`{ currency, theme, biometric, notifications }` (`stores/preferencesStore.ts`,
encrypted Zustand persist) and preserves any other keys. `usePreferenceSync()`
applies server values whenever GET `/me` returns new ones (e.g. sign-in on
another device), and adopts the profile `language` (switching language reloads
the app for RTL/LTR). `useSavePreferences()` (`hooks/usePreferences.ts`)
applies changes locally first, then sends PUT `/me` with
`{ language?, preferences: JSON.stringify(mergedObject) }`, rolling back on
failure. A language change is saved before switching, since the switch reloads.

- Currency: EGP, SAR, AED, KWD, QAR, BHD, OMR, USD, EUR.
- Appearance: `system` / `light` / `dark`, applied app-wide through
  `Appearance.setColorScheme` and `useColors()`; kept on sign-out.
- Biometric: enabling or disabling requires a successful Face ID / Touch ID /
  fingerprint check (`expo-local-authentication`, device passcode fallback).
  When on, `BiometricLock` covers the app on launch and after 30s in the
  background, with a sign-out escape. Devices without biometrics or a passcode
  are not locked. Sign-out resets currency, biometric and notifications.

## Client and session helpers

Every request sets `Content-Type: application/json` and `Accept-Language`
(`ar` or `en`) from the saved language/device preference. The public auth
endpoints never receive an old Bearer token. Other requests read the hydrated,
current auth-store session before setting Authorization. Existing generated AI
API calls keep their separate working base URL.

The endpoint contracts live in `lib/api-spec/identity.openapi.yaml`; the
generated React Query hooks use an injected Axios transport, separate from
the generated AI service. Regenerate with
`pnpm --filter @workspace/api-spec run codegen`.

Use `await setAuthTokens(completeTokens)` from `@/storage/authToken` or
`await useAuthStore.getState().saveSession(completeTokens)` only after real OTP
verification. `await getAuthToken()` waits for hydration.
Use `logoutSession(queryClient)` to sign out. It first calls POST
`/v1/identity/auth/logout` with `{ refreshToken }` (this device only; 204),
which blacklists the access token and revokes the refresh token. The call uses
the interceptor-free client, so a 401 never triggers a refresh that would mint
new tokens after logout; an expiring session is rotated first so the current
refresh token is revoked. Revocation is best effort (10s timeout): offline or
server errors still complete the local sign-out. It then cancels and clears
every cached query and clears both tokens. `useSignOut()` (Profile and the
biometric lock screen) additionally clears local financial data and
account preferences; the confirmation explicitly warns of this.
`clearAuthToken()` only clears the token session.

Response errors are rejected unchanged by the Axios interceptor. UI errors
are localized and do not print server messages, tokens, or request configs.
Storage failures reject rather than silently claiming a session was saved.
Invalid/expired/exhausted codes, rate limits, and profile loading errors have
explicit UI states.

## Backend and security boundaries

The supplied documentation says OTP delivery currently writes to backend D1
logs until an SMS sender is configured. Requesting a code is not proof that
an SMS was delivered. Development test codes remain a backend behavior;
the client does not bypass verification.

MFA-required accounts remain signed out until the challenge/recovery call
succeeds. POST `/v1/identity/auth/refresh` is public and takes only
`{ refreshToken }`, with JSON and Accept-Language headers. It returns a flat
new token pair; the old refresh token is revoked. Protected requests refresh
within 30 seconds of expiry or retry once after a 401. Concurrent requests
share one rotation; new tokens are encrypted durably before waiting requests
continue. Refresh preserves the profile and verified phone, validates the
same userId, and cannot resurrect a logged-out session. Invalid/revoked or
inactive-account responses clear the session; network/5xx failures do not
discard credentials. No automatic retry is sent to the rotating refresh API.

## Encryption and development transport

The auth snapshot contains tokens, expiry metadata, full API profile, and
the server-validated phone number. It is encrypted as one authenticated
AES-256-GCM payload; volatile flags, passwords and OTPs are not persisted.
Each write has a fresh 96-bit nonce, and the storage key is bound as additional
authenticated data. Native keys are random and stored in Expo SecureStore;
web keys are non-exportable WebCrypto CryptoKeys in IndexedDB. No hardcoded,
public-environment, or plaintext AsyncStorage encryption keys are used.
This protects stored data; it does not protect against a compromised running
app or same-origin malicious script.

Local financial state/account labels are also encrypted to avoid plaintext
copies of API names/emails. Legacy local state is encrypted before replacing
it. All persisted state uses Zustand `persist` with encrypted storage: the auth
session (`stores/authStore.ts`) and local app data (`stores/appStore.ts`). The
auth store keeps the former `persist:bassera_identity` key and reads the old
redux-persist format, rewriting it in the Zustand format; legacy plaintext
Zustand tokens also migrate before their old key is removed. Auth writes are
queued so an older snapshot can never land after a newer one (e.g. resurrect a
logged-out session). Failed reads/decryption do not overwrite data with defaults.

Expo Go and web development requests both use `/api/identity-dev` on the
existing API server when connecting to the owner's HTTP backend. This avoids
direct HTTP IP/port restrictions on devices as well as browser mixed content.
The fixed-target
allowlisted bridge forwards JSON, language, Bearer headers for `/me`,
status codes and Retry-After without logging bodies/tokens. It is disabled in
production; production mobile requests also refuse the development HTTP URL.
HTTPS protects only the device/browser-to-Replit leg; upstream remains plain HTTP.
Supply an HTTPS backend before publishing with real credentials.

Public docs required authorization. The owner subsequently supplied the
generic identity/auth/refresh contract (not consumer/auth/refresh).
Actual email-OTP validation/request/verification contracts are still needed.
