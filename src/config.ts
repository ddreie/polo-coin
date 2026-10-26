// Supabase project. The publishable key is public by design (it ships to every browser);
// all access rules are enforced inside the database functions (supabase/setup.sql).
export const SUPABASE_URL = 'https://fllxsypsclizpjpypnqv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jnwQO7PLwiQT6unzCRb0mQ_k3mhQ_8_';

// `npm run dev:demo` / `build:demo` run without Supabase; data then stays in the browser.
export const LOCAL_MODE = import.meta.env.MODE === 'demo';
