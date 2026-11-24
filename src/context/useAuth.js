// Objet de contexte et hook useAuth séparés du composant AuthProvider
// pour préserver le Fast Refresh de Vite et éviter l'avertissement oxlint.
import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

// Hook utilitaire pour consommer le contexte d'authentification
export function useAuth() {
  const contexte = useContext(AuthContext);

  if (!contexte) {
    throw new Error('useAuth doit être utilisé à l’intérieur de AuthProvider.');
  }

  return contexte;
}
