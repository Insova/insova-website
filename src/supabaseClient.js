import { createClient } from '@supabase/supabase-js';

/*
  Both values are safe in the browser. The anon key is designed to be
  public; what protects the data is row level security in Postgres, not
  secrecy of this key. The service role key must never appear here.

  Set these in .env.local for development and in Railway's variables for
  production. Create React App only exposes variables prefixed
  REACT_APP_.
*/
const url = process.env.REACT_APP_SUPABASE_URL;https://xupgmjomufmxhiwljbev.supabase.co/rest/v1/
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cGdtam9tdWZteGhpd2xqYmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzA3MTMsImV4cCI6MjEwMjY0NjcxM30.GSGie4yXng6MTFBLFBVBgjcN9lmAUvPLyQkrVz4DCok

export const configured = Boolean(url && anonKey);

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;