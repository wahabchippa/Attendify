import { createClient } from '@supabase/supabase-js';

// Asli correct URL (Typo fix ho gaya)
const url = 'https://gefkpawkljalbevkxytn.supabase.co';

// Aapki asli 'anon' JWT API key (4th wali)
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZmtwYXdrbGphbGJldmt4eXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjQ5ODgsImV4cCI6MjA5Njk0MDk4OH0.2MC8c4HpKYbBfO_0FCE53_nnwkN7nhqjYIAbvKGHSZE';

export const supabase = createClient(url, key);
