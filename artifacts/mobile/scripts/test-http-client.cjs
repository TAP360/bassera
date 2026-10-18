const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const axios = require("axios");

function loadSource(relativePath, mocks) {
  const file = path.join(__dirname, "..", relativePath);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const mockedRequire = (name) => name === "@/utils/reactotron"
    ? { reportApiRequest() {} }
    : name in mocks ? mocks[name] : require(name);
  new Function("require", "module", "exports", source)(mockedRequire, module, module.exports);
  return module.exports;
}

async function main() {
  let savedLanguage = "ar";
  let deviceLanguage = "en";
  const preferences = loadSource("localization/preferences.ts", {
    "@react-native-async-storage/async-storage": { getItem: async () => savedLanguage },
    "expo-localization": { getLocales: () => [{ languageCode: deviceLanguage }] },
  });
  assert.equal(await preferences.getRequestLanguage(), "ar");
  savedLanguage = "en";
  assert.equal(await preferences.getRequestLanguage(), "en");
  savedLanguage = "unsupported";
  deviceLanguage = "ar-SA";
  assert.equal(await preferences.getRequestLanguage(), "ar");
  deviceLanguage = "fr";
  assert.equal(await preferences.getRequestLanguage(), "en");
  const countries = loadSource("utils/countries.ts", {});
  const options = countries.getCountryOptions("en");
  assert.ok(options.length >= 240, "Include all supported worldwide calling-code countries and territories");
  assert.equal(new Set(options.map((item) => item.country)).size, options.length);
  for (const country of ["EG", "US", "CA", "GB", "SA", "IN", "JP", "ZA", "BR", "AU"]) {
    assert.ok(options.some((option) => option.country === country));
  }
  assert.equal(countries.getCountryOptions("ar").find((o) => o.country === "EG").name, "مصر");
  assert.deepEqual(countries.splitInternationalInput("+20 01012345678", "EG"), {
    identifier: "01012345678", countryCode: "+20", country: "EG",
  });
  assert.equal(countries.splitInternationalInput("00966501234567", "EG").countryCode, "+966");
  assert.equal(countries.splitInternationalInput("+١٢٠٢٥٥٥٠١٢٣", "EG").countryCode, "+1");
  assert.equal(countries.splitInternationalInput("201012345678", "EG").countryCode, "+20");
  assert.equal(countries.splitInternationalInput("+12425550123", "EG").country, "BS");
  assert.equal(countries.splitInternationalInput("01012345678", "EG").identifier, "01012345678");
  assert.equal(countries.splitInternationalInput("person@example.invalid", "EG").identifier, "person@example.invalid");
  assert.equal(countries.splitInternationalInput("+4", "EG").identifier, "+4", "Preserve incomplete calling codes while typing");

  const values = new Map();
  let writeError;
  let readError;
  let writeGate;
  const asyncStorage = {
    setItem: async (key, value) => {
      if (writeGate) await writeGate;
      if (writeError) throw writeError;
      values.set(key, value);
    },
    getItem: async (key) => {
      if (readError) throw readError;
      return values.get(key) ?? null;
    },
    removeItem: async (key) => { values.delete(key); },
  };
  globalThis.indexedDB = require("fake-indexeddb").indexedDB;
  Object.defineProperty(globalThis, "crypto", { value: require("node:crypto").webcrypto, configurable: true });
  const storageCore = loadSource("storage/encryptedStorageCore.ts", {
    "@react-native-async-storage/async-storage": asyncStorage,
  });
  const secureStorage = loadSource("storage/encryptedStorage.web.ts", {
    "./encryptedStorageCore": storageCore,
  });
  const modules = [];
  const createStoreModule = () => {
    const instance = loadSource("stores/authStore.ts", {
      "@react-native-async-storage/async-storage": asyncStorage,
      "@/storage/encryptedStorage": secureStorage,
    });
    modules.push(instance);
    return instance;
  };
  const storeModule = createStoreModule();
  const tokenStore = loadSource("storage/authToken.ts", {
    "@/stores/authStore": storeModule,
  });
  const tokens = (accessToken = "test-token-only") => ({
    accessToken, refreshToken: "test-refresh-only", userId: "test-consumer",
    userType: "CONSUMER", expiresIn: 900,
  });
  assert.throws(() => storeModule.sessionFromVerification({ mfaRequired: true, tokens: tokens() }), /MFA_REQUIRED/);
  assert.throws(() => storeModule.sessionFromVerification({ mfaRequired: false }), /INVALID_SESSION/);
  assert.deepEqual(storeModule.sessionFromVerification({ mfaRequired: false, tokens: tokens() }), tokens());
  assert.equal(await tokenStore.getAuthToken(), null);
  await tokenStore.setAuthTokens(tokens("Bearer test-token-only"));
  assert.equal(await tokenStore.getAuthToken(), "test-token-only");
  const cipher = values.get(storeModule.AUTH_STORAGE_KEY);
  assert.ok(cipher.startsWith(storageCore.ENCRYPTED_PREFIX));
  assert.equal(cipher.includes("test-token-only"), false);
  assert.equal(cipher.includes("test-refresh-only"), false);
  const persisted = JSON.parse(await secureStorage.encryptedStorage.getItem(storeModule.AUTH_STORAGE_KEY));
  assert.equal(JSON.parse(persisted.tokens).refreshToken, "test-refresh-only");
  assert.equal(persisted.sessionReady, undefined);
  const restoredModule = createStoreModule();
  await restoredModule.ensureAuthHydrated();
  assert.equal(restoredModule.useAuthStore.getState().tokens.accessToken, "test-token-only");
  assert.equal(restoredModule.useAuthStore.getState().tokens.refreshToken, "test-refresh-only");
  assert.equal(restoredModule.useAuthStore.getState().sessionReady, true);
  await tokenStore.setAuthTokens(tokens("updated-test-token"));
  assert.equal(await tokenStore.getAuthToken(), "updated-test-token");
  await tokenStore.clearAuthToken();
  assert.equal(await tokenStore.getAuthToken(), null);
  await assert.rejects(tokenStore.setAuthTokens(tokens(" ")), /INVALID_SESSION/);
  await assert.rejects(tokenStore.setAuthTokens(tokens("bad\nvalue")), /INVALID_SESSION/);
  await assert.rejects(tokenStore.setAuthTokens({ ...tokens(), refreshToken: "" }), /INVALID_SESSION/);
  writeError = new Error("Storage unavailable");
  await assert.rejects(tokenStore.setAuthTokens(tokens("not-saved")), /SESSION_STORAGE_FAILED/);
  assert.equal(storeModule.useAuthStore.getState().tokens, null);
  assert.equal(storeModule.useAuthStore.getState().sessionReady, false);
  writeError = undefined;
  let releaseWrite;
  writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  const saving = tokenStore.setAuthTokens(tokens());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storeModule.useAuthStore.getState().sessionReady, false);
  assert.equal(await tokenStore.getAuthToken(), null, "Unsaved sessions cannot authorize requests");
  releaseWrite();
  await saving;
  writeGate = undefined;
  assert.equal(storeModule.useAuthStore.getState().sessionReady, true);

  let language = "ar";
  let languageError;
  const { httpClient, HTTP_BASE_URL } = loadSource("utils/httpClient.ts", {
    "@/stores/authStore": storeModule,
    "react-native": { Platform: { OS: "ios" } },
    "@/localization/preferences": {
      getRequestLanguage: async () => {
        if (languageError) throw languageError;
        return language;
      },
    },
    "@/storage/authToken": tokenStore,
  });
  assert.equal(HTTP_BASE_URL, "https://nero.tap-360.com");
  const oldDomain = process.env.EXPO_PUBLIC_DOMAIN;
  const oldIdentityUrl = process.env.EXPO_PUBLIC_IDENTITY_API_URL;
  try {
    process.env.EXPO_PUBLIC_DOMAIN = "development-bridge.test";
    process.env.EXPO_PUBLIC_IDENTITY_API_URL = "https://nero.tap-360.com/";
    for (const os of ["ios", "android", "web"]) {
      const relay = loadSource("utils/httpClient.ts", {
        "@/stores/authStore": storeModule,
        "@/storage/authToken": tokenStore,
        "@/localization/preferences": { getRequestLanguage: async () => "en" },
        "react-native": { Platform: { OS: os } },
      });
      assert.equal(relay.HTTP_BASE_URL, "https://nero.tap-360.com", `${os} must use the supplied identity API`);
      assert.equal(relay.refreshClient.defaults.baseURL, relay.HTTP_BASE_URL);
    }
    process.env.EXPO_PUBLIC_IDENTITY_API_URL = "https://custom-identity.test";
    const custom = loadSource("utils/httpClient.ts", {
      "@/stores/authStore": storeModule, "@/storage/authToken": tokenStore,
      "@/localization/preferences": { getRequestLanguage: async () => "en" },
    });
    assert.equal(custom.HTTP_BASE_URL, "https://nero.tap-360.com");
  } finally {
    if (oldDomain === undefined) delete process.env.EXPO_PUBLIC_DOMAIN; else process.env.EXPO_PUBLIC_DOMAIN = oldDomain;
    if (oldIdentityUrl === undefined) delete process.env.EXPO_PUBLIC_IDENTITY_API_URL; else process.env.EXPO_PUBLIC_IDENTITY_API_URL = oldIdentityUrl;
  }
  let requestCount = 0;
  httpClient.defaults.adapter = async (config) => {
    requestCount++;
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
  await tokenStore.setAuthTokens(tokens("test-token-only"));
  const first = await httpClient.get("/test", { headers: { "Content-Type": "text/plain" } });
  assert.equal(first.config.headers.get("Content-Type"), "application/json");
  assert.equal(first.config.headers.get("Accept-Language"), "ar");
  assert.equal(first.config.headers.get("Authorization"), "Bearer test-token-only");
  assert.equal(first.status, 200);
  assert.deepEqual(first.data, { ok: true });
  language = "en";
  await tokenStore.setAuthTokens(tokens("second-test-token"));
  const second = await httpClient.get("/test");
  assert.equal(second.config.headers.get("Accept-Language"), "en");
  assert.equal(second.config.headers.get("Authorization"), "Bearer second-test-token");
  await tokenStore.clearAuthToken();
  const anonymous = await httpClient.get("/test", { headers: { Authorization: "Bearer stale-test-token" } });
  assert.equal(anonymous.config.headers.has("Authorization"), false);
  languageError = new Error("Language storage failed");
  await assert.rejects(httpClient.get("/test"), (error) => error === languageError);
  assert.equal(requestCount, 3, "A request interceptor failure must prevent dispatch");
  languageError = undefined;
  const failedHydrationModule = createStoreModule();
  const failedTokens = loadSource("storage/authToken.ts", { "@/stores/authStore": failedHydrationModule });
  const failedClient = loadSource("utils/httpClient.ts", {
    "@/stores/authStore": failedHydrationModule,
    "react-native": { Platform: { OS: "ios" } },
    "@/localization/preferences": { getRequestLanguage: async () => "en" },
    "@/storage/authToken": failedTokens,
  }).httpClient;
  failedClient.defaults.adapter = () => { throw new Error("A hydration failure must prevent dispatch"); };
  readError = new Error("Storage unavailable");
  await assert.rejects(failedClient.get("/test"), /SESSION_STORAGE_FAILED/);
  readError = undefined;
  await failedHydrationModule.ensureAuthHydrated();
  await tokenStore.setAuthTokens(tokens("stale-token"));
  const publicRequest = await httpClient.post("/v1/identity/consumer/auth/otp/request", {});
  assert.equal(publicRequest.config.headers.has("Authorization"), false, "Public auth calls must not leak old tokens");
  assert.equal(publicRequest.config.headers.get("Accept-Language"), "en");
  const failure = new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST");
  httpClient.defaults.adapter = async () => { throw failure; };
  await assert.rejects(httpClient.get("/test"), (error) => error === failure);
  const errorMessages = loadSource("utils/authErrors.ts", {});
  assert.match(errorMessages.authErrorMessage(new Error("MFA_REQUIRED"), "en"), /additional verification/);
  assert.match(errorMessages.authErrorMessage(new Error("OTP_EXPIRED"), "en"), /expired/);
  assert.match(errorMessages.authErrorMessage(new Error("OTP_EXPIRED"), "ar"), /انتهت/);
  await tokenStore.clearAuthToken();

  const transport = loadSource("../../lib/api-client-react/src/identity-request.ts", {});
  transport.setIdentityTransport(async (config) => (await httpClient.request(config)).data);
  const api = loadSource("../../lib/api-client-react/src/identity-generated/identity.ts", {
    "../identity-request": transport,
  });
  const calls = [];
  httpClient.defaults.adapter = async (config) => {
    calls.push(config);
    let data;
    if (config.url.endsWith("/phone/validate")) data = { valid: true, e164: "+201012345678" };
    else if (config.url.endsWith("/otp/request")) data = { expiresIn: 300, resendAfter: 60 };
    else if (config.url.endsWith("/otp/verify")) data = { newUser: false, mfaRequired: false, tokens: tokens("verified-token") };
    else if (config.url.endsWith("/me")) data = { id: "test-consumer", name: "Test Consumer" };
    else throw new Error("Unexpected test request");
    return { data, status: config.url.endsWith("/otp/request") ? 202 : 200, statusText: "OK", headers: {}, config };
  };
  const validated = await api.validateConsumerPhone({ countryCode: "+20", phone: "01012345678" });
  const requested = await api.requestConsumerOtp({
    businessCode: "neurowealth", phone: validated.e164, language: "en",
  });
  assert.equal(requested.resendAfter, 60);
  const verified = await api.verifyConsumerOtp({ businessCode: "neurowealth", phone: validated.e164, otp: "123456" });
  await tokenStore.setAuthTokens(verified.tokens);
  const { QueryClient } = require("@tanstack/react-query");
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const session = loadSource("hooks/useConsumerSession.ts", {
    "@workspace/api-client-react": api,
    "@/stores/authStore": storeModule,
    "@/utils/identityTransport": {},
  });
  const me = await cache.fetchQuery(session.consumerQueryOptions(storeModule.useAuthStore.getState().tokens));
  assert.equal(me.name, "Test Consumer");
  assert.equal(cache.getQueryData(session.consumerQueryKey("test-consumer")).id, "test-consumer");
  assert.notDeepEqual(session.consumerQueryKey("test-consumer"), session.consumerQueryKey("another-consumer"));
  assert.deepEqual(calls.map((c) => c.method), ["post", "post", "post", "get"]);
  assert.deepEqual(JSON.parse(calls[0].data), { countryCode: "+20", phone: "01012345678" });
  assert.deepEqual(JSON.parse(calls[1].data), {
    businessCode: "neurowealth", phone: "+201012345678", language: "en",
  });
  assert.deepEqual(JSON.parse(calls[2].data), { businessCode: "neurowealth", phone: "+201012345678", otp: "123456" });
  for (const call of calls.slice(0, 3)) assert.equal(call.headers.has("Authorization"), false);
  assert.equal(calls[3].headers.get("Authorization"), "Bearer verified-token");
  await assert.rejects(cache.fetchQuery(session.consumerQueryOptions({ ...tokens(), userId: "wrong-consumer" })), /INVALID_PROFILE/);
  await session.logoutSession(cache);
  assert.equal(await tokenStore.getAuthToken(), null);
  assert.equal(JSON.parse(JSON.parse(await secureStorage.encryptedStorage.getItem(storeModule.AUTH_STORAGE_KEY)).tokens), null);
  assert.equal(cache.getQueryData(session.consumerQueryKey("test-consumer")), undefined);
  cache.clear();
  const emailOtpCalls = [];
  httpClient.defaults.adapter = async (config) => {
    emailOtpCalls.push(config);
    const data = config.url.endsWith("/otp/email/request")
      ? { expiresIn: 300, resendAfter: 60 }
      : { newUser: true, mfaRequired: false, tokens: tokens("email-verified-token") };
    return {
      data,
      status: config.url.endsWith("/otp/email/request") ? 202 : 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  const emailRequested = await api.requestConsumerEmailOtp({
    businessCode: "neurowealth", email: "person@example.invalid",
  });
  assert.equal(emailRequested.expiresIn, 300);
  const emailVerified = await api.verifyConsumerOtp({
    businessCode: "neurowealth", email: "person@example.invalid", otp: "123456",
  });
  assert.equal(emailVerified.newUser, true);
  assert.equal(emailVerified.tokens.accessToken, "email-verified-token");
  assert.deepEqual(emailOtpCalls.map((config) => config.url), [
    "/v1/identity/consumer/auth/otp/email/request",
    "/v1/identity/consumer/auth/otp/verify",
  ]);
  assert.deepEqual(JSON.parse(emailOtpCalls[0].data), {
    businessCode: "neurowealth", email: "person@example.invalid",
  });
  assert.deepEqual(JSON.parse(emailOtpCalls[1].data), {
    businessCode: "neurowealth", email: "person@example.invalid", otp: "123456",
  });
  for (const config of emailOtpCalls) {
    assert.equal(config.headers.has("Authorization"), false);
    assert.equal(config.headers.get("Accept-Language"), "en");
  }
  await storeModule.useAuthStore.getState().saveSession(tokens("new-user-token"), undefined, true);
  assert.equal(storeModule.useAuthStore.getState().surveyPending, true, "First-time users must be routed to the survey");
  assert.equal(JSON.parse(JSON.parse(await secureStorage.encryptedStorage.getItem(storeModule.AUTH_STORAGE_KEY)).surveyPending), true);
  await storeModule.markSurveyComplete();
  assert.equal(storeModule.useAuthStore.getState().surveyPending, false);
  await storeModule.useAuthStore.getState().saveSession(tokens("returning-token"));
  assert.equal(storeModule.useAuthStore.getState().surveyPending, false, "Returning users go straight Home");
  await tokenStore.clearAuthToken();
  const emailCalls = [];
  httpClient.defaults.adapter = async (config) => {
    emailCalls.push(config);
    const path = config.url;
    const data = path.endsWith("/register") ? { userId: "test-consumer", message: "Code requested" }
      : path.endsWith("/login") ? { mfaRequired: true, userId: "test-consumer" }
      : tokens("flat-session-token");
    return { data, status: path.endsWith("/register") ? 201 : 200, statusText: "OK", headers: {}, config };
  };
  const credentials = { email: "person@example.invalid", password: "test-only-password", businessCode: "NW-EG" };
  const registration = await api.registerConsumer(credentials);
  assert.equal(registration.userId, "test-consumer");
  const activated = await api.verifyConsumerRegistrationOtp({ userId: registration.userId, otp: "123456" });
  assert.equal(storeModule.validateSession(activated).accessToken, "flat-session-token");
  assert.equal(activated.tokens, undefined, "Registration verification returns a flat token object");
  const needsMfa = await api.loginConsumer(credentials);
  assert.equal(needsMfa.mfaRequired, true);
  assert.equal(needsMfa.tokens, undefined);
  const challenged = await api.challengeConsumerMfa({ userId: needsMfa.userId, totpCode: "123456" });
  const recovered = await api.recoverConsumerMfa({ userId: needsMfa.userId, recoveryCode: "TEST-ONLY" });
  assert.equal(storeModule.validateSession(challenged).userId, "test-consumer");
  assert.equal(storeModule.validateSession(recovered).userId, "test-consumer");
  assert.deepEqual(emailCalls.map((c) => c.url), [
    "/v1/identity/consumer/auth/register", "/v1/identity/consumer/auth/verify-otp",
    "/v1/identity/consumer/auth/login", "/v1/identity/consumer/auth/mfa/challenge",
    "/v1/identity/consumer/auth/mfa/recovery",
  ]);
  assert.deepEqual(JSON.parse(emailCalls[0].data), credentials);
  assert.deepEqual(JSON.parse(emailCalls[1].data), { userId: "test-consumer", otp: "123456" });
  assert.deepEqual(JSON.parse(emailCalls[2].data), credentials);
  assert.deepEqual(JSON.parse(emailCalls[3].data), { userId: "test-consumer", totpCode: "123456" });
  assert.deepEqual(JSON.parse(emailCalls[4].data), { userId: "test-consumer", recoveryCode: "TEST-ONLY" });
  for (const call of emailCalls) {
    assert.equal(call.headers.has("Authorization"), false);
    assert.equal(call.headers.get("Accept-Language"), "en");
  }
  await secureStorage.encryptedStorage.setItem("@mindwealth_state", JSON.stringify({ name: "Encrypted Person" }));
  assert.equal(values.get("@mindwealth_state").includes("Encrypted Person"), false);
  assert.equal(JSON.parse(await secureStorage.encryptedStorage.getItem("@mindwealth_state")).name, "Encrypted Person");
  const encryptedOriginal = values.get("@mindwealth_state");
  values.set("@mindwealth_state", encryptedOriginal.slice(0, -2) + (encryptedOriginal.endsWith("00") ? "01" : "00"));
  await assert.rejects(secureStorage.encryptedStorage.getItem("@mindwealth_state"), /SESSION_STORAGE_FAILED/);
  values.set("@mindwealth_state", encryptedOriginal);
  values.set("@mindwealth_accounts", '["migration@example.invalid"]');
  assert.equal(await secureStorage.encryptedStorage.getItem("@mindwealth_accounts"), '["migration@example.invalid"]');
  assert.equal(values.get("@mindwealth_accounts").includes("migration@example.invalid"), false);
  await tokenStore.setAuthTokens(tokens("profile-token"));
  await storeModule.saveConsumerProfile({ id: "test-consumer", name: "Encrypted API Name", email: "test@example.invalid", demographics: { age: 28 } });
  assert.equal(values.get(storeModule.AUTH_STORAGE_KEY).includes("Encrypted API Name"), false);
  assert.equal(values.get(storeModule.AUTH_STORAGE_KEY).includes("test@example.invalid"), false);
  const profileRestored = createStoreModule();
  await profileRestored.ensureAuthHydrated();
  assert.equal(profileRestored.useAuthStore.getState().profile.name, "Encrypted API Name");
  assert.equal(profileRestored.useAuthStore.getState().profile.demographics.age, 28);
  await assert.rejects(storeModule.saveConsumerProfile({ id: "wrong-person" }), /INVALID_PROFILE/);
  await tokenStore.clearAuthToken();
  assert.equal(storeModule.useAuthStore.getState().profile, null);
  for (const instance of modules) { await instance.identityPersistor.flush(); instance.identityPersistor.pause(); }
  values.delete(storeModule.AUTH_STORAGE_KEY);
  values.set("@bassera_auth_session", JSON.stringify({ state: { tokens: tokens("legacy-token") }, version: 1 }));
  const migrated = createStoreModule();
  await migrated.ensureAuthHydrated();
  assert.equal(migrated.useAuthStore.getState().tokens.accessToken, "legacy-token");
  assert.equal(values.has("@bassera_auth_session"), false);
  assert.equal(values.get(storeModule.AUTH_STORAGE_KEY).includes("legacy-token"), false);
  await migrated.identityPersistor.flush();
  migrated.identityPersistor.pause();
  const secureKeys = new Map();
  const nativeStorage = loadSource("storage/encryptedStorage.native.ts", {
    "./encryptedStorageCore": storageCore,
    "expo-secure-store": {
      isAvailableAsync: async () => true,
      getItemAsync: async (key) => secureKeys.get(key) ?? null,
      setItemAsync: async (key, value) => { secureKeys.set(key, value); },
    },
    "expo-crypto": { getRandomBytesAsync: async (size) => new Uint8Array(require("node:crypto").randomBytes(size)) },
  });
  await nativeStorage.encryptedStorage.setItem("native-identity-test", '{"name":"Native encrypted person"}');
  assert.equal(await nativeStorage.encryptedStorage.getItem("native-identity-test"), '{"name":"Native encrypted person"}');
  assert.equal(values.get("native-identity-test").includes("Native encrypted person"), false);
  assert.equal(secureKeys.size, 1, "Native encryption key belongs in SecureStore, not AsyncStorage");
  const nativeCipher = values.get("native-identity-test");
  values.set("native-identity-test", nativeCipher.slice(0, -2) + (nativeCipher.endsWith("00") ? "01" : "00"));
  await assert.rejects(nativeStorage.encryptedStorage.getItem("native-identity-test"), /SESSION_STORAGE_FAILED/);
  httpClient.defaults.adapter = async (config) => ({ data: { id: "test-consumer", name: "Updated API Name" }, status: 200, statusText: "OK", headers: {}, config });
  const edited = await api.updateCurrentConsumer({ name: "Updated API Name" });
  assert.equal(edited.name, "Updated API Name");
  const rotatingStore = createStoreModule();
  const rotatingTokens = loadSource("storage/authToken.ts", { "@/stores/authStore": rotatingStore });
  const clients = loadSource("utils/httpClient.ts", {
    "@/stores/authStore": rotatingStore,
    "@/storage/authToken": rotatingTokens,
    "@/localization/preferences": { getRequestLanguage: async () => "en" },
    "react-native": { Platform: { OS: "ios" } },
  });
  await rotatingTokens.setAuthTokens({ ...tokens("old-access"), refreshToken: "old-refresh", expiresIn: 1 });
  await rotatingStore.saveConsumerProfile({ id: "test-consumer", name: "Refresh profile" });
  let refreshCount = 0;
  clients.refreshClient.defaults.adapter = async (config) => {
    refreshCount++;
    assert.equal(config.url, "/v1/identity/auth/refresh");
    assert.equal(config.headers.has("Authorization"), false);
    assert.equal(config.headers.get("Accept-Language"), "en");
    assert.deepEqual(JSON.parse(config.data), { refreshToken: refreshCount === 1 ? "old-refresh" : "rotated-refresh" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { data: { ...tokens(`rotated-access-${refreshCount}`), refreshToken: refreshCount === 1 ? "rotated-refresh" : "second-refresh" }, status: 200, statusText: "OK", headers: {}, config };
  };
  clients.httpClient.defaults.adapter = async (config) => {
    assert.equal(config.headers.get("Authorization"), "Bearer rotated-access-1");
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
  await Promise.all([1, 2, 3].map(() => clients.httpClient.get("/protected")));
  assert.equal(refreshCount, 1, "Concurrent near-expiry requests must rotate exactly once");
  assert.equal(rotatingStore.useAuthStore.getState().profile.name, "Refresh profile");
  assert.equal(rotatingStore.useAuthStore.getState().tokens.refreshToken, "rotated-refresh");
  clients.httpClient.defaults.adapter = async (config) => {
    if (!config._identityRetried) {
      throw new (require("axios").AxiosError)("Expired", "ERR_BAD_REQUEST", config, undefined,
        { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config });
    }
    assert.equal(config.headers.get("Authorization"), "Bearer rotated-access-2");
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
  await Promise.all([1, 2, 3].map(() => clients.httpClient.get("/protected")));
  assert.equal(refreshCount, 2, "Concurrent 401s must rotate once and retry with the new pair");
  assert.equal(rotatingStore.useAuthStore.getState().tokens.refreshToken, "second-refresh");
  const restoredRotation = createStoreModule();
  await restoredRotation.ensureAuthHydrated();
  assert.equal(restoredRotation.useAuthStore.getState().tokens.refreshToken, "second-refresh");
  assert.equal(restoredRotation.useAuthStore.getState().profile.name, "Refresh profile");
  assert.equal(values.get(rotatingStore.AUTH_STORAGE_KEY).includes("second-refresh"), false);
  await restoredRotation.identityPersistor.flush(); restoredRotation.identityPersistor.pause();
  clients.httpClient.defaults.adapter = async (config) => {
    throw new (require("axios").AxiosError)("Expired", "ERR_BAD_REQUEST", config, undefined,
      { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config });
  };
  clients.refreshClient.defaults.adapter = async (config) => {
    throw new (require("axios").AxiosError)("Revoked", "ERR_BAD_REQUEST", config, undefined,
      { data: { code: "INVALID_REFRESH_TOKEN" }, status: 400, statusText: "Bad Request", headers: {}, config });
  };
  await assert.rejects(clients.httpClient.get("/protected"));
  assert.equal(rotatingStore.useAuthStore.getState().tokens, null);
  assert.equal(rotatingStore.useAuthStore.getState().profile, null);
  await assert.rejects(rotatingStore.rotateSession(tokens("late-access"), "second-refresh"), /INVALID_SESSION/);
  await rotatingStore.identityPersistor.flush(); rotatingStore.identityPersistor.pause();
  console.log("Refresh checks passed: documented contract, single-flight expiry/401 rotation, encrypted durability, retained profile, revoked-token logout and late-response protection.");
  console.log("Mobile auth checks passed: AES-GCM encryption/tamper protection, encrypted Redux token/profile restore and logout, migration, persistence failures, API contracts, languages, headers and cache isolation.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
