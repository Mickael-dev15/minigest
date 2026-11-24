// Client Supabase unique pour l'application React MiniGest v2.
// Sécurité : seule la clé publique (publishable) est autorisée côté navigateur.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Vérification explicite des variables d'environnement au démarrage
const variablesManquantes = [];

if (!supabaseUrl || !supabaseUrl.trim()) {
  variablesManquantes.push('VITE_SUPABASE_URL');
}

if (!supabasePublishableKey || !supabasePublishableKey.trim()) {
  variablesManquantes.push('VITE_SUPABASE_PUBLISHABLE_KEY');
}

if (variablesManquantes.length > 0) {
  throw new Error(
    `Configuration Supabase incomplète : variable(s) manquante(s) dans .env.local (${variablesManquantes.join(', ')}).`
  );
}

export const supabase = createClient(
  supabaseUrl.trim(),
  supabasePublishableKey.trim()
);
