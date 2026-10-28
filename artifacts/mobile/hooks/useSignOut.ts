import { useAppStore } from "@/stores/appStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useSessionLogout } from "./useConsumerSession";

/** Ends the session and clears this account's local data and preferences. */
export function useSignOut() {
  const logout = useSessionLogout();
  return async () => {
    await logout();
    useAppStore.getState().reset();
    usePreferencesStore.getState().resetAccountPreferences();
  };
}
