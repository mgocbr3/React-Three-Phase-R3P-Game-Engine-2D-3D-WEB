import { create } from 'zustand';
import { pixllandClient } from '@/legacy/cloud/integrations/pixlland/client';
import type { User, Session } from '@supabase/supabase-js';
import { usePixllandUserStore } from '@/stores/pixllandUserStore';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';

const DEV_AUTH_STORAGE_KEY = 'pixlplaygroundstudio:dev-auth-email';
const DEV_AUTH_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === 'true';
const DEV_AUTH_EMAIL = (import.meta.env.VITE_DEV_AUTH_EMAIL || '').trim();
const DEV_AUTH_PASSWORD = import.meta.env.VITE_DEV_AUTH_PASSWORD || '';

const createDevSession = (email: string): Session => {
  const now = new Date().toISOString();
  const user = {
    id: 'pixlland-dev-user',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: {
      provider: 'dev',
      providers: ['dev'],
    },
    user_metadata: {
      full_name: 'Pixlland Dev',
      name: 'Pixlland Dev',
    },
    created_at: now,
    updated_at: now,
  } as User;

  return {
    access_token: 'pixlland-dev-local-token',
    refresh_token: 'pixlland-dev-local-refresh-token',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: 'bearer',
    user,
  } as Session;
};

const applyDevSession = (set: (state: Partial<AuthState>) => void, email: string) => {
  const session = createDevSession(email);

  set({
    session,
    user: session.user,
    profile: {
      displayName: 'Pixlland Dev',
      avatarUrl: null,
    },
    isLoading: false,
  });

  usePixllandUserStore.getState().setProfile({
    userId: session.user.id,
    email,
    username: 'dev',
    displayName: 'Pixlland Dev',
    avatarUrl: null,
    wallet: { coins: null },
    level: null,
    xp: null,
  });
};

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: {
    displayName: string | null;
    avatarUrl: string | null;
  };
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Partial<AuthState['profile']>) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  loadProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: {
    displayName: null,
    avatarUrl: null,
  },
  isLoading: ENGINE_CLOUD_ENABLED,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
  setLoading: (isLoading) => set({ isLoading }),
  loadProfile: async (userId: string) => {
    if (!ENGINE_CLOUD_ENABLED) {
      return;
    }

    if (userId === 'pixlland-dev-user') {
      return;
    }

    try {
      console.log('[Auth] Loading profile for user:', userId);
      
      // Try to get profile from Pixlland backend (uses 'id' as PK matching auth.uid())
      // The Pixlland schema uses 'id' directly, not 'user_id'
      const { data, error } = await pixllandClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('[Auth] Profile query result:', { data, error });

      // Also get user metadata from auth for fallback
      const { data: { user } } = await pixllandClient.auth.getUser();
      const metaName = user?.user_metadata?.name as string | undefined;
      const metaAvatar = user?.user_metadata?.avatar_url as string | undefined;

      if (!error && data) {
        // Pixlland profile found - use its data (cast to any for flexible field access)
        const profileData = data as Record<string, any>;
        const displayName = profileData.display_name || profileData.name || metaName || null;
        const avatarUrl = profileData.avatar_url || profileData.photo_url || metaAvatar || null;
        const username = profileData.username || null;
        const coins = profileData.pixl_coins ?? profileData.coins ?? null;
        const level = profileData.level ?? null;
        const xp = profileData.xp ?? null;

        set({ profile: {
          displayName,
          avatarUrl,
        }});

        usePixllandUserStore.getState().setProfile({
          userId: userId,
          email: user?.email || null,
          username,
          displayName,
          avatarUrl,
          wallet: { coins },
          level,
          xp,
        });
        
        console.log('[Auth] Profile loaded from Pixlland:', displayName, avatarUrl, { coins, level });
      } else {
        // Fallback to user_metadata from auth
        console.warn('[Auth] Pixlland profile not found, using metadata:', error?.message);
        
        if (metaName || metaAvatar) {
          set({ profile: {
            displayName: metaName || null,
            avatarUrl: metaAvatar || null,
          }});

          usePixllandUserStore.getState().setProfile({
            userId: userId,
            email: user?.email || null,
            username: null,
            displayName: metaName || null,
            avatarUrl: metaAvatar || null,
            wallet: { coins: null },
            level: null,
            xp: null,
          });
          
          console.log('[Auth] Profile loaded from metadata:', metaName);
        }
      }
    } catch (err) {
      console.warn('[Auth] Failed to load profile', err);
    }
  },

  signIn: async (email: string, password: string) => {
    if (!ENGINE_CLOUD_ENABLED) {
      return { error: new Error('Cloud auth is disabled for this engine build.') };
    }

    set({ isLoading: true });
    try {
      if (DEV_AUTH_ENABLED && DEV_AUTH_EMAIL && DEV_AUTH_PASSWORD) {
        if (email.trim().toLowerCase() === DEV_AUTH_EMAIL.toLowerCase() && password === DEV_AUTH_PASSWORD) {
          applyDevSession(set, DEV_AUTH_EMAIL);
          localStorage.setItem(DEV_AUTH_STORAGE_KEY, DEV_AUTH_EMAIL);
          return { error: null };
        }

        if (email.trim().toLowerCase() === DEV_AUTH_EMAIL.toLowerCase()) {
          throw new Error('Credenciais dev inválidas.');
        }
      }

      const { data, error } = await pixllandClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session?.user) {
        get().loadProfile(data.session.user.id);
      }
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      return { error: error as Error };
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    if (!ENGINE_CLOUD_ENABLED) {
      return { error: new Error('Cloud auth is disabled for this engine build.') };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await pixllandClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: displayName,
          },
        },
      });
      if (error) throw error;
      if (data.user) {
        // Best-effort upsert profile with display name
        if (displayName) {
          (async () => {
            try {
              await pixllandClient.from('profiles')
                .upsert({ user_id: data.user!.id, display_name: displayName }, { onConflict: 'user_id' });
              console.log('[Auth] Profile upserted');
            } catch (err) {
              console.warn('[Auth] Failed to upsert profile', err);
            }
          })();
        }
        get().loadProfile(data.user.id);
      }
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      return { error: error as Error };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    if (!ENGINE_CLOUD_ENABLED) {
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      set({ user: null, session: null, profile: { displayName: null, avatarUrl: null }, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      await pixllandClient.auth.signOut();
      set({ user: null, session: null, profile: { displayName: null, avatarUrl: null } });
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  initialize: async () => {
    if (get().isInitialized) return;
    // Evita dupla inicialização em React StrictMode (Preview) e múltiplos listeners.
    set({ isInitialized: true });

    if (!ENGINE_CLOUD_ENABLED) {
      set({ user: null, session: null, isLoading: false });
      return;
    }
    
    console.log('[Auth] Initializing with Pixlland backend...');

    const storedDevEmail = localStorage.getItem(DEV_AUTH_STORAGE_KEY);
    if (DEV_AUTH_ENABLED && DEV_AUTH_EMAIL && storedDevEmail === DEV_AUTH_EMAIL) {
      console.log('[Auth] Restoring local dev session');
      applyDevSession(set, DEV_AUTH_EMAIL);
      return;
    }
    
    // Set up auth state listener FIRST
    pixllandClient.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State change:', event, session?.user?.email);
      set({ session, user: session?.user ?? null, isLoading: false });
      if (session?.user) {
        get().loadProfile(session.user.id);
        const metaName = session.user.user_metadata?.full_name as string | undefined;
        const metaAvatar = session.user.user_metadata?.avatar_url as string | undefined;
        if (metaName || metaAvatar) {
          set((state) => ({ profile: {
            displayName: metaName || state.profile.displayName,
            avatarUrl: metaAvatar || state.profile.avatarUrl,
          }}));
        }
      }
    });

    // Then get initial session (shared with Pixlland platform)
    const { data: { session } } = await pixllandClient.auth.getSession();
    
    if (session) {
      console.log('[Auth] Found existing Pixlland session:', session.user.email);
      get().loadProfile(session.user.id);
    }
    
    set({ 
      session, 
      user: session?.user ?? null, 
      isLoading: false,
    });
  },
}));
