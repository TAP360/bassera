import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { QuestionnaireResult } from '@/utils/questionnaireScoring';
import { createEncryptedPersist } from './encryptedPersist';

export type PersonalityType =
  | 'Money Vigilance'
  | 'Money Worship'
  | 'Money Status'
  | 'Money Avoidance'
  | 'Money Obligation'
  | null;

export type MoodType = 'great' | 'good' | 'neutral' | 'stressed' | 'anxious';

export type SubscriptionTier = 'free' | 'premium' | 'premium_plus';

/** Device-only profile data that the identity API does not provide. */
export interface LocalProfile {
  photoUri?: string;
  personalityType: PersonalityType;
  /** Latest Money Attitude questionnaire result from onboarding. */
  moneyAttitude?: QuestionnaireResult | null;
  subscription: SubscriptionTier;
  joinDate: string;
  wellnessScore: number;
  efiScore: number;
  confidenceScore: number;
}

export interface LocalTransaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  emotionTag?: string;
  note?: string;
}

export interface LocalGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  icon: string;
  deadline: string;
  color: string;
}

export type LinkedAccountKind = 'checking' | 'savings' | 'credit' | 'investment' | 'other';

export interface LinkedAccount {
  id: string;
  institution: string;
  label: string;
  kind: LinkedAccountKind;
  last4?: string;
  source: 'manual';
  createdAt: string;
}

export type PaymentMethodKind = 'account' | 'card' | 'wallet';

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  accountId?: string;
  provider?: string;
  last4?: string;
  createdAt: string;
}

export interface AppData {
  hasOnboarded: boolean;
  profile: LocalProfile;
  mood: MoodType | null;
  transactions: LocalTransaction[];
  goals: LocalGoal[];
  linkedAccounts: LinkedAccount[];
  paymentMethods: PaymentMethod[];
  streak: number;
  nudgesCount: number;
}

interface AppActions {
  completeOnboarding: (personality: PersonalityType, moneyAttitude?: QuestionnaireResult) => void;
  updateLocalProfile: (updates: Partial<Pick<LocalProfile, 'photoUri'>>) => void;
  setMood: (mood: MoodType) => void;
  addTransaction: (transaction: Omit<LocalTransaction, 'id'>) => void;
  updateGoal: (id: string, amount: number) => void;
  addGoal: (goal: Omit<LocalGoal, 'id'>) => void;
  addLinkedAccount: (account: Pick<LinkedAccount, 'institution' | 'label' | 'kind' | 'last4'>) => void;
  removeLinkedAccount: (id: string) => void;
  addPaymentMethod: (method: Pick<PaymentMethod, 'kind' | 'label' | 'accountId' | 'provider' | 'last4'>) => void;
  removePaymentMethod: (id: string) => void;
  reset: () => void;
}

export type AppStore = AppData & AppActions;

const defaultProfile: LocalProfile = {
  personalityType: null,
  subscription: 'free',
  joinDate: 'Jan 2025',
  wellnessScore: 72,
  efiScore: 68,
  confidenceScore: 75,
};

const defaultTransactions: LocalTransaction[] = [
  { id: '1', title: 'Morning Coffee', category: 'Food & Drink', amount: -85, date: 'Today', type: 'expense', emotionTag: 'routine' },
  { id: '2', title: 'Salary Deposit', category: 'Income', amount: 15000, date: 'Yesterday', type: 'income' },
  { id: '3', title: 'Online Shopping', category: 'Shopping', amount: -420, date: '2 days ago', type: 'expense', emotionTag: 'impulse' },
  { id: '4', title: 'Gym Membership', category: 'Health', amount: -200, date: '3 days ago', type: 'expense', emotionTag: 'planned' },
  { id: '5', title: 'Freelance Payment', category: 'Income', amount: 3500, date: '4 days ago', type: 'income' },
];

const defaultGoals: LocalGoal[] = [
  { id: '1', title: 'Emergency Fund', target: 30000, current: 18500, icon: 'shield', deadline: 'Dec 2025', color: '#22C55E' },
  { id: '2', title: 'New Car', target: 120000, current: 45000, icon: 'car', deadline: 'Jun 2026', color: '#2E3192' },
  { id: '3', title: 'Travel Fund', target: 15000, current: 8200, icon: 'airplane', deadline: 'Mar 2026', color: '#F37021' },
  { id: '4', title: 'Education', target: 50000, current: 12000, icon: 'book', deadline: 'Sep 2026', color: '#92278F' },
];

const defaultData: AppData = {
  hasOnboarded: false,
  profile: defaultProfile,
  mood: null,
  transactions: defaultTransactions,
  goals: defaultGoals,
  linkedAccounts: [],
  paymentMethods: [],
  streak: 12,
  nudgesCount: 3,
};

// Same key the former AppContext used, so existing device data is migrated in place.
export const APP_STORAGE_KEY = '@mindwealth_state';
const STORE_VERSION = 1;

const appPersist = createEncryptedPersist<AppData>('APP_STORAGE_FAILED', (parsed) =>
  // Pre-Zustand AppContext stored the bare state object.
  parsed && typeof parsed === 'object' ? { state: parsed as AppData, version: 0 } : null,
);

function sanitize(saved: Partial<AppData> | undefined, current: AppData): AppData {
  if (!saved || typeof saved !== 'object') return current;
  // Legacy profiles also stored name/email; those now come from the identity API.
  const { name: _name, email: _email, ...savedProfile } = (saved.profile ?? {}) as Partial<LocalProfile> & {
    name?: string;
    email?: string;
  };
  return {
    ...current,
    ...saved,
    profile: { ...current.profile, ...savedProfile },
    transactions: Array.isArray(saved.transactions) ? saved.transactions : current.transactions,
    goals: Array.isArray(saved.goals) ? saved.goals : current.goals,
    linkedAccounts: Array.isArray(saved.linkedAccounts) ? saved.linkedAccounts : [],
    paymentMethods: Array.isArray(saved.paymentMethods) ? saved.paymentMethods : [],
  };
}

const newId = () => Date.now().toString() + Math.random().toString(36).slice(2, 8);

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...defaultData,
      completeOnboarding: (personalityType, moneyAttitude) =>
        set((state) => ({
          hasOnboarded: true,
          profile: {
            ...state.profile,
            personalityType,
            moneyAttitude: moneyAttitude ?? state.profile.moneyAttitude,
          },
        })),
      updateLocalProfile: (updates) => set((state) => ({ profile: { ...state.profile, ...updates } })),
      setMood: (mood) => set({ mood }),
      addTransaction: (transaction) =>
        set((state) => ({ transactions: [{ ...transaction, id: newId() }, ...state.transactions] })),
      updateGoal: (id, amount) =>
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === id ? { ...goal, current: Math.min(goal.current + amount, goal.target) } : goal,
          ),
        })),
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, { ...goal, id: newId() }] })),
      addLinkedAccount: (account) =>
        set((state) => ({
          linkedAccounts: [
            { ...account, id: newId(), source: 'manual', createdAt: new Date().toISOString() },
            ...state.linkedAccounts,
          ],
        })),
      removeLinkedAccount: (id) =>
        set((state) => ({
          linkedAccounts: state.linkedAccounts.filter((account) => account.id !== id),
          paymentMethods: state.paymentMethods.filter((method) => method.accountId !== id),
        })),
      addPaymentMethod: (method) =>
        set((state) => ({
          paymentMethods: [{ ...method, id: newId(), createdAt: new Date().toISOString() }, ...state.paymentMethods],
        })),
      removePaymentMethod: (id) =>
        set((state) => ({ paymentMethods: state.paymentMethods.filter((method) => method.id !== id) })),
      reset: () => set(defaultData),
    }),
    {
      name: APP_STORAGE_KEY,
      version: STORE_VERSION,
      storage: appPersist.storage,
      skipHydration: true,
      partialize: ({
        hasOnboarded,
        profile,
        mood,
        transactions,
        goals,
        linkedAccounts,
        paymentMethods,
        streak,
        nudgesCount,
      }) => ({ hasOnboarded, profile, mood, transactions, goals, linkedAccounts, paymentMethods, streak, nudgesCount }),
      migrate: (persisted) => persisted as AppData,
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted as Partial<AppData>, current) }),
    },
  ),
);

/** Loads persisted app data once; rejects (without wiping data) if it cannot be decrypted. */
export function hydrateAppStore(): Promise<void> {
  return appPersist.hydrate(useAppStore);
}
