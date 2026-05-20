import { createClient } from '@supabase/supabase-js';

const PIXLLAND_URL = import.meta.env.VITE_PIXLLAND_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const PIXLLAND_ANON_KEY =
  import.meta.env.VITE_PIXLLAND_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'local-development-anon-key';
const PIXLLAND_PROJECT_ID = import.meta.env.VITE_PIXLLAND_PROJECT_ID || 'local';

export const isPixllandConfigured = Boolean(
  import.meta.env.VITE_PIXLLAND_SUPABASE_URL && import.meta.env.VITE_PIXLLAND_SUPABASE_PUBLISHABLE_KEY
);

export const pixllandClient = createClient(PIXLLAND_URL, PIXLLAND_ANON_KEY, {
  auth: {
    storageKey: 'pixlplayground-pixlland-auth',
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const PIXLLAND_CONFIG = {
  url: PIXLLAND_URL,
  projectId: PIXLLAND_PROJECT_ID,
  enabled: isPixllandConfigured,
};
