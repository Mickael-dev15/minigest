// Point d'entrée principal de l'application React
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// On affiche le composant racine <App /> dans la balise <div id="root"> de index.html
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
