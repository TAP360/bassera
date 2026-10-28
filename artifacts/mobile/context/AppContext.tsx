import { encryptedStorage as AsyncStorage } from '@/storage/encryptedStorage';
import { useAuthStore } from '@/stores/authStore';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalization } from '@/localization';
import type { QuestionnaireResult } from '@/utils/questionnaireScoring';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type PersonalityType =
  | 'Money Vigilance'
  | 'Money Worship'
  | 'Money Status'
  | 'Money Avoidance'
  | 'Money Obligation'
  | null;

export type MoodType = 'great' | 'good' | 'neutral' | 'stressed' | 'anxious';

interface UserProfile {
  name: string;
  email: string;
  photoUri?: string;
  personalityType: PersonalityType;
  /** Latest Money Attitude questionnaire result from onboarding. */
  moneyAttitude?: QuestionnaireResult | null;
  subscription: 'free' | 'premium' | 'premium_plus';
  joinDate: string;
  wellnessScore: number;
  efiScore: number;
  confidenceScore: number;
}

interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  type: 'expense' | 'income';
  emotionTag?: string;
  note?: string;
}

interface Goal {
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

interface AppState {
  hasOnboarded: boolean;
  profile: UserProfile;
  mood: MoodType | null;
  transactions: Transaction[];
  goals: Goal[];
  linkedAccounts: LinkedAccount[];
  paymentMethods: PaymentMethod[];
  streak: number;
  nudgesCount: number;
}

interface AppContextValue extends AppState {
  completeOnboarding: (
    personality: PersonalityType,
    name?: string,
    email?: string,
    moneyAttitude?: QuestionnaireResult,
  ) => Promise<void>;
  checkAccountExists: (email: string) => Promise<boolean>;
  signIn: (email: string) => Promise<void>;
  clearData: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'name' | 'email' | 'photoUri'>>) => Promise<void>;
  setMood: (mood: MoodType) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateGoal: (id: string, amount: number) => void;
  addGoal: (g: Omit<Goal, 'id'>) => void;
  addLinkedAccount: (account: Pick<LinkedAccount, 'institution' | 'label' | 'kind' | 'last4'>) => void;
  removeLinkedAccount: (id: string) => void;
  addPaymentMethod: (method: Pick<PaymentMethod, 'kind' | 'label' | 'accountId' | 'provider' | 'last4'>) => void;
  removePaymentMethod: (id: string) => void;
}

const defaultProfile: UserProfile = {
  name: 'Ahmed',
  email: 'ahmed@example.com',
  personalityType: null,
  subscription: 'free',
  joinDate: 'Jan 2025',
  wellnessScore: 72,
  efiScore: 68,
  confidenceScore: 75,
};

const defaultTransactions: Transaction[] = [
  {
    id: '1',
    title: 'Morning Coffee',
    category: 'Food & Drink',
    amount: -85,
    date: 'Today',
    type: 'expense',
    emotionTag: 'routine',
  },
  {
    id: '2',
    title: 'Salary Deposit',
    category: 'Income',
    amount: 15000,
    date: 'Yesterday',
    type: 'income',
  },
  {
    id: '3',
    title: 'Online Shopping',
    category: 'Shopping',
    amount: -420,
    date: '2 days ago',
    type: 'expense',
    emotionTag: 'impulse',
  },
  {
    id: '4',
    title: 'Gym Membership',
    category: 'Health',
    amount: -200,
    date: '3 days ago',
    type: 'expense',
    emotionTag: 'planned',
  },
  {
    id: '5',
    title: 'Freelance Payment',
    category: 'Income',
    amount: 3500,
    date: '4 days ago',
    type: 'income',
  },
];

const defaultGoals: Goal[] = [
  {
    id: '1',
    title: 'Emergency Fund',
    target: 30000,
    current: 18500,
    icon: 'shield',
    deadline: 'Dec 2025',
    color: '#22C55E',
  },
  {
    id: '2',
    title: 'New Car',
    target: 120000,
    current: 45000,
    icon: 'car',
    deadline: 'Jun 2026',
    color: '#2E3192',
  },
  {
    id: '3',
    title: 'Travel Fund',
    target: 15000,
    current: 8200,
    icon: 'airplane',
    deadline: 'Mar 2026',
    color: '#F37021',
  },
  {
    id: '4',
    title: 'Education',
    target: 50000,
    current: 12000,
    icon: 'book',
    deadline: 'Sep 2026',
    color: '#92278F',
  },
];

const defaultState: AppState = {
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

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = '@mindwealth_state';
const ACCOUNTS_KEY = '@mindwealth_accounts';

async function readAccounts(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function registerAccount(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const accounts = await readAccounts();
  if (!accounts.includes(normalized)) {
    accounts.push(normalized);
    try {
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {}
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const consumer = useAuthStore((identity) => identity.profile);
  const { language } = useLocalization();
  const displayProfile = {
    ...state.profile,
    name: consumer?.name?.trim() || (language === 'ar' ? 'عضو بصيرة' : 'Bassera member'),
    email: consumer?.email || '',
  };

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    setLoadError(false);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AppState>;
        setState((prev) => ({
          ...prev,
          ...saved,
          profile: { ...prev.profile, ...saved.profile },
          linkedAccounts: Array.isArray(saved.linkedAccounts) ? saved.linkedAccounts : [],
          paymentMethods: Array.isArray(saved.paymentMethods) ? saved.paymentMethods : [],
        }));
      }
      setLoaded(true);
    } catch {
      // Do not overwrite saved data with defaults when reads/decryption fail.
      setLoadError(true);
    }
  };

  // Persist the complete local state, including newly recorded transactions.
  // Wait until the initial read finishes so the default state cannot overwrite it.
  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
      console.error('Unable to save Bassera data', error);
    });
  }, [loaded, state]);

  const completeOnboarding = useCallback(
    async (
      personality: PersonalityType,
      name?: string,
      email?: string,
      moneyAttitude?: QuestionnaireResult,
    ) => {
      if (email) await registerAccount(email);
      setState((prev) => {
        const next: AppState = {
          ...prev,
          hasOnboarded: true,
          profile: {
            ...prev.profile,
            personalityType: personality,
            moneyAttitude: moneyAttitude ?? prev.profile.moneyAttitude,
            name: name ?? prev.profile.name,
            email: email?.trim() || prev.profile.email,
          },
        };
        return next;
      });
    },
    [],
  );

  const checkAccountExists = useCallback(async (email: string) => {
    const accounts = await readAccounts();
    return accounts.includes(email.trim().toLowerCase());
  }, []);

  const signIn = useCallback(async (email: string) => {
    setState((prev) => {
      const next: AppState = {
        ...prev,
        hasOnboarded: true,
        profile: {
          ...prev.profile,
          email: email.trim() || prev.profile.email,
        },
      };
      return next;
    });
  }, []);

  const clearData = useCallback(async () => {
    setState(defaultState);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<UserProfile, 'name' | 'email' | 'photoUri'>>) => {
      setState((prev) => {
        const next: AppState = {
          ...prev,
          profile: { ...prev.profile, ...updates },
        };
        return next;
      });
    },
    [],
  );

  const setMood = useCallback((mood: MoodType) => {
    setState((prev) => ({ ...prev, mood }));
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    const tx: Transaction = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    };
    setState((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
    }));
  }, []);

  const updateGoal = useCallback((id: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === id
          ? { ...g, current: Math.min(g.current + amount, g.target) }
          : g,
      ),
    }));
  }, []);

  const addGoal = useCallback((g: Omit<Goal, 'id'>) => {
    const goal: Goal = {
      ...g,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
    };
    setState((prev) => ({ ...prev, goals: [...prev.goals, goal] }));
  }, []);

  const addLinkedAccount = useCallback(
    (account: Pick<LinkedAccount, 'institution' | 'label' | 'kind' | 'last4'>) => {
      const linked: LinkedAccount = {
        ...account,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        source: 'manual',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, linkedAccounts: [linked, ...prev.linkedAccounts] }));
    },
    [],
  );

  const removeLinkedAccount = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      linkedAccounts: prev.linkedAccounts.filter((account) => account.id !== id),
      paymentMethods: prev.paymentMethods.filter((method) => method.accountId !== id),
    }));
  }, []);

  const addPaymentMethod = useCallback(
    (method: Pick<PaymentMethod, 'kind' | 'label' | 'accountId' | 'provider' | 'last4'>) => {
      const entry: PaymentMethod = {
        ...method,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, paymentMethods: [entry, ...prev.paymentMethods] }));
    },
    [],
  );

  const removePaymentMethod = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter((method) => method.id !== id),
    }));
  }, []);

  if (!loaded) return (
    <View style={{ flex: 1, backgroundColor: '#0B1026', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
      {loadError ? <>
        <Text accessibilityRole="alert" style={{ color: '#FFFFFF', textAlign: 'center' }}>
          {language === 'ar' ? 'تعذر فتح البيانات المحفوظة. لم يتم حذف بياناتك.' : 'Unable to unlock saved data. Your data has not been deleted.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void loadState()}>
          <Text style={{ color: '#FFFFFF' }}>{language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}</Text>
        </Pressable>
      </> : <ActivityIndicator color="#FFFFFF" />}
    </View>
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        profile: displayProfile,
        completeOnboarding,
        checkAccountExists,
        signIn,
        clearData,
        updateProfile,
        setMood,
        addTransaction,
        updateGoal,
        addGoal,
        addLinkedAccount,
        removeLinkedAccount,
        addPaymentMethod,
        removePaymentMethod,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
