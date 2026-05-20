import { create } from 'zustand';

export interface PixllandWallet {
  coins?: number | null;
  gems?: number | null;
  premium?: number | null;
}

export interface PixllandProfile {
  userId: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  badges: string[];
  roles: string[];
  plan: string | null;
  locale: string | null;
  wallet: PixllandWallet;
  level: number | null;
  xp: number | null;
}

interface PixllandUserStore {
  profile: PixllandProfile;
  setProfile: (profile: Partial<PixllandProfile>) => void;
  setWallet: (wallet: PixllandWallet) => void;
  clear: () => void;
}

const initialProfile: PixllandProfile = {
  userId: null,
  email: null,
  username: null,
  displayName: null,
  avatarUrl: null,
  badges: [],
  roles: [],
  plan: null,
  locale: null,
  wallet: {},
  level: null,
  xp: null,
};

export const usePixllandUserStore = create<PixllandUserStore>((set) => ({
  profile: initialProfile,
  setProfile: (profile) => set((state) => ({
    profile: {
      ...state.profile,
      ...profile,
      wallet: { ...state.profile.wallet, ...(profile.wallet || {}) },
      badges: profile.badges ?? state.profile.badges,
      roles: profile.roles ?? state.profile.roles,
    },
  })),
  setWallet: (wallet) => set((state) => ({
    profile: { ...state.profile, wallet: { ...state.profile.wallet, ...wallet } },
  })),
  clear: () => set({ profile: initialProfile }),
}));
