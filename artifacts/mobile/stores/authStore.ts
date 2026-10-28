import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { ConsumerTokens, ConsumerProfile, OtpVerificationResult } from "@workspace/api-client-react";
import { encryptedStorage } from "@/storage/encryptedStorage";

// Key inherited from the former redux-persist store so existing sessions survive the migration.
export const AUTH_STORAGE_KEY = "persist:bassera_identity";
const LEGACY_KEY = "@bassera_auth_session";
const STORE_VERSION = 3;
const PERSISTED_KEYS = ["tokens", "profile", "phone", "expiresAt", "profileFetchedAt", "surveyPending"] as const;

interface IdentityData {
  tokens: ConsumerTokens | null;
  profile: ConsumerProfile | null;
  phone: string | null;
  expiresAt: number;
  profileFetchedAt: number;
  sessionReady: boolean;
  /** First-time user who has not finished the onboarding survey yet. */
  surveyPending: boolean;
}
type PersistedIdentity = Pick<IdentityData, (typeof PERSISTED_KEYS)[number]>;
interface IdentityState extends IdentityData {
  saveSession: (tokens: ConsumerTokens, phone?: string, newUser?: boolean) => Promise<void>;
  clearSession: () => Promise<void>;
}

const initialData: IdentityData = {
  tokens: null, profile: null, phone: null, expiresAt: 0, profileFetchedAt: 0, sessionReady: false,
  surveyPending: false,
};
let hydrationError: unknown;
let writes: Promise<void> = Promise.resolve();
let lastWritten: string | undefined;

function pickPersisted(state: IdentityData): PersistedIdentity {
  return {
    tokens: state.tokens, profile: state.profile, phone: state.phone, expiresAt: state.expiresAt,
    profileFetchedAt: state.profileFetchedAt, surveyPending: state.surveyPending,
  };
}

/** redux-persist stored every whitelisted field as its own JSON string. */
function fromReduxPersist(raw: Record<string, unknown>): Partial<PersistedIdentity> {
  const payload: Partial<PersistedIdentity> = {};
  for (const key of PERSISTED_KEYS) {
    if (typeof raw[key] === "string") (payload as Record<string, unknown>)[key] = JSON.parse(raw[key] as string);
  }
  return payload;
}

const identityStorage: PersistStorage<PersistedIdentity> = {
  async getItem(name) {
    try {
      const raw = await encryptedStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StorageValue<PersistedIdentity> | Record<string, unknown>;
      const state = parsed && typeof parsed === "object" && "state" in parsed && "version" in parsed
        ? (parsed as StorageValue<PersistedIdentity>).state
        : fromReduxPersist(parsed as Record<string, unknown>);
      return { state: state as PersistedIdentity, version: STORE_VERSION };
    } catch (error) {
      hydrationError = error;
      throw new Error("SESSION_STORAGE_FAILED");
    }
  },
  setItem(name, value) {
    // Encryption is async, so writes are queued to keep an older snapshot from landing last.
    const write = writes.catch(() => undefined).then(async () => {
      // Never overwrite an unread or unreadable session with in-memory defaults.
      if (hydrationError || !useAuthStore.persist.hasHydrated()) throw new Error("SESSION_STORAGE_FAILED");
      // Non-persisted changes (e.g. sessionReady) produce an identical snapshot; skip re-encrypting it.
      const serialized = JSON.stringify(value);
      if (serialized === lastWritten) return;
      await encryptedStorage.setItem(name, serialized);
      lastWritten = serialized;
    });
    writes = write;
    return write;
  },
  removeItem: (name) => encryptedStorage.removeItem(name),
};

export const useAuthStore = create<IdentityState>()(
  persist(
    () => ({ ...initialData, saveSession, clearSession }),
    {
      name: AUTH_STORAGE_KEY,
      version: STORE_VERSION,
      storage: identityStorage,
      skipHydration: true,
      partialize: pickPersisted,
      onRehydrateStorage: () => (_state, error) => {
        if (error) hydrationError ??= error;
      },
    },
  ),
);

/** Applies a state change and resolves once its encrypted write has completed. */
function commit(partial: Partial<IdentityData>): Promise<void> {
  // The persist middleware returns the storage write promise from setState.
  return Promise.resolve(useAuthStore.setState(partial) as unknown as Promise<void>);
}
async function commitOrFail(partial: Partial<IdentityData>): Promise<void> {
  try { await commit(partial); }
  catch { throw new Error("SESSION_STORAGE_FAILED"); }
}
function setReady(sessionReady: boolean): void {
  void commit({ sessionReady }).catch(() => undefined);
}
function sessionData(tokens: ConsumerTokens, phone?: string | null, newUser = false): Partial<IdentityData> {
  return {
    tokens, profile: null, profileFetchedAt: 0, phone: phone ?? null, surveyPending: newUser === true,
    expiresAt: Date.now() + tokens.expiresIn * 1000, sessionReady: false,
  };
}

let hydration: Promise<void> | undefined;
let bootstrapped = false;
let operations = Promise.resolve();

function normalizeToken(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_SESSION");
  const token = value.trim().replace(/^Bearer\s+/i, "");
  if (!token || /\s/.test(token)) throw new Error("INVALID_SESSION");
  return token;
}
export function validateSession(value: ConsumerTokens): ConsumerTokens {
  if (!value || typeof value.userId !== "string" || !value.userId.trim() ||
    typeof value.userType !== "string" || !value.userType.trim() ||
    !Number.isFinite(value.expiresIn) || value.expiresIn <= 0) throw new Error("INVALID_SESSION");
  return {
    accessToken: normalizeToken(value.accessToken), refreshToken: normalizeToken(value.refreshToken),
    userId: value.userId, userType: value.userType, expiresIn: value.expiresIn,
  };
}
export function sessionFromVerification(result: OtpVerificationResult): ConsumerTokens {
  if (result?.mfaRequired === true) throw new Error("MFA_REQUIRED");
  if (result?.mfaRequired !== false || !result.tokens) throw new Error("INVALID_SESSION");
  return validateSession(result.tokens);
}
export function ensureAuthHydrated(): Promise<void> {
  if (bootstrapped) return Promise.resolve();
  if (!hydration) {
    hydration = (async () => {
      hydrationError = undefined;
      await useAuthStore.persist.rehydrate();
      if (hydrationError || !useAuthStore.persist.hasHydrated()) throw new Error("SESSION_STORAGE_FAILED");
      const state = useAuthStore.getState();
      if (state.tokens) {
        validateSession(state.tokens);
        if (state.profile && state.profile.id !== state.tokens.userId) throw new Error("INVALID_PROFILE");
      } else {
        const legacy = await AsyncStorage.getItem(LEGACY_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed.state?.tokens) await commitOrFail(sessionData(validateSession(parsed.state.tokens)));
          await AsyncStorage.removeItem(LEGACY_KEY);
        }
      }
      // Rewrites redux-persist data in the current format and covers a crash before legacy cleanup.
      await commitOrFail({});
      await AsyncStorage.removeItem(LEGACY_KEY);
      await AsyncStorage.removeItem("@bassera_access_token");
      bootstrapped = true;
      setReady(!!useAuthStore.getState().tokens);
    })();
    void hydration.catch(() => { hydration = undefined; });
  }
  return hydration;
}
function serialize(action: () => Promise<void>): Promise<void> {
  const operation = operations.catch(() => undefined).then(action);
  operations = operation;
  void operation.catch(() => undefined);
  return operation;
}
async function saveSession(raw: ConsumerTokens, phone?: string, newUser = false): Promise<void> {
  await ensureAuthHydrated();
  const tokens = validateSession(raw);
  return serialize(async () => {
    try {
      await commit(sessionData(tokens, phone, newUser));
    } catch {
      await commit({ ...initialData }).catch(() => undefined);
      throw new Error("SESSION_STORAGE_FAILED");
    }
    setReady(true);
  });
}
export async function saveConsumerProfile(profile: ConsumerProfile): Promise<void> {
  await ensureAuthHydrated();
  return serialize(async () => {
    if (!profile || profile.id !== useAuthStore.getState().tokens?.userId) throw new Error("INVALID_PROFILE");
    await commitOrFail({ profile, profileFetchedAt: Date.now() });
  });
}
export async function markSurveyComplete(): Promise<void> {
  await ensureAuthHydrated();
  return serialize(async () => {
    if (!useAuthStore.getState().surveyPending) return;
    await commitOrFail({ surveyPending: false });
  });
}
export async function rotateSession(raw: ConsumerTokens, previousRefreshToken: string): Promise<void> {
  const tokens = validateSession(raw);
  return serialize(async () => {
    const current = useAuthStore.getState().tokens;
    if (!current || current.refreshToken !== previousRefreshToken || current.userId !== tokens.userId) {
      throw new Error("INVALID_SESSION");
    }
    try {
      await commit({ tokens, expiresAt: Date.now() + tokens.expiresIn * 1000 });
    } catch {
      // The server revoked the old refresh token; never roll back to it.
      await commit({ ...initialData }).catch(() => undefined);
      throw new Error("SESSION_STORAGE_FAILED");
    }
  });
}
async function clearSession(): Promise<void> {
  await ensureAuthHydrated();
  return serialize(async () => {
    const { saveSession: _save, clearSession: _clear, ...previous } = useAuthStore.getState();
    try {
      await commit({ ...initialData });
      await AsyncStorage.removeItem(LEGACY_KEY);
    } catch {
      // Retain the previous session if durable logout failed.
      if (previous.tokens) void commit(previous).catch(() => undefined);
      throw new Error("SESSION_STORAGE_FAILED");
    }
  });
}
