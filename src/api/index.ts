import { LOCAL_MODE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { createLocalApi } from './localApi';
import { createSupabaseApi } from './supabaseApi';
import type { Api } from './types';

export const api: Api = LOCAL_MODE ? createLocalApi() : createSupabaseApi(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export * from './types';
