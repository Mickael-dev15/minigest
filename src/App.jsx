// Routage principal de MiniGest v2 selon l'authentification, le rôle et le statut de l'entreprise.
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { useAuth } from './context/useAuth.js';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import EspaceClients from './pages/EspaceClients.jsx';
import AccesRefuse from './pages/AccesRefuse.jsx';

// Vérifie si le profil correspond à un super_admin actif
function estSuperAdminActif(profil) {
  return Boolean(profil && profil.actif && profil.role === 'super_admin');
}

// Vérifie si le profil correspond à un gérant ou employé actif d'une entreprise active
function estEntrepriseActive(profil) {
  return Boolean(
    profil &&
      profil.actif &&
      (profil.role === 'gerant' || profil.role === 'employe') &&
      profil.entreprise?.statut === 'active'
  );
}

// Écran d'attente affiché tant que chargement === true (aucune redirection prématurée)
function EcranChargement() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <p className="loading-text">Chargement...</p>
    </div>
  );
}

// Route "/" : oriente automatiquement vers l'espace adapté au rôle connecté
function RedirectionAccueil() {
  const { session, profil, chargement } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return <Navigate to="/admin" replace />;
  }

  if (estEntrepriseActive(profil)) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/acces-refuse" replace />;
}

// Garde pour "/login" : évite d'afficher le formulaire si l'utilisateur est déjà connecté
function RouteConnexion({ children }) {
  const { session, chargement } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Garde pour "/admin" : strictement réservée au super_admin actif
function RouteSuperAdmin({ children }) {
  const { session, profil, chargement } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return children;
  }

  if (estEntrepriseActive(profil)) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to="/acces-refuse" replace />;
}

// Garde pour "/app" : réservée aux gérants et employés actifs d'une entreprise active
function RouteEntreprise({ children }) {
  const { session, profil, chargement } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (estEntrepriseActive(profil)) {
    return children;
  }

  if (estSuperAdminActif(profil)) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/acces-refuse" replace />;
}

// Garde pour "/acces-refuse" : uniquement pour un utilisateur connecté bloqué
function RouteAccesRefuse({ children }) {
  const { session, profil, chargement } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return <Navigate to="/admin" replace />;
  }

  if (estEntrepriseActive(profil)) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectionAccueil />} />
      <Route
        path="/login"
        element={
          <RouteConnexion>
            <Login />
          </RouteConnexion>
        }
      />
      <Route
        path="/admin"
        element={
          <RouteSuperAdmin>
            <Admin />
          </RouteSuperAdmin>
        }
      />
      <Route
        path="/app"
        element={
          <RouteEntreprise>
            <EspaceClients />
          </RouteEntreprise>
        }
      />
      <Route
        path="/acces-refuse"
        element={
          <RouteAccesRefuse>
            <AccesRefuse />
          </RouteAccesRefuse>
        }
      />
      {/* Toute route inconnue renvoie vers la racine qui redirige selon le rôle */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
