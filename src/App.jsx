// Routage principal de MiniGest v2 selon l'authentification, le rôle,
// le statut du compte / de l'entreprise et l'obligation de changement de mot de passe.
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { useAuth } from './context/useAuth.js';
import Login from './pages/Login.jsx';
import MotDePasseOublie from './pages/MotDePasseOublie.jsx';
import Reinitialisation from './pages/Reinitialisation.jsx';
import ChangerMotDePasse from './pages/ChangerMotDePasse.jsx';
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

// Indique si l'utilisateur connecté a un compte et une entreprise actifs (non bloqués)
function aAccesAutorise(profil) {
  return estSuperAdminActif(profil) || estEntrepriseActive(profil);
}

// Écran d'attente affiché tant que chargement === true (aucune redirection prématurée)
function EcranChargement() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <p className="loading-text">Chargement...</p>
    </div>
  );
}

// Route "/" : oriente automatiquement vers l'espace adapté au rôle connecté.
// Ordre des contrôles : accès bloqué (/acces-refuse) EN PREMIER, puis doit_changer_mdp.
function RedirectionAccueil() {
  const { session, profil, chargement, doitChangerMdp } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!aAccesAutorise(profil)) {
    return <Navigate to="/acces-refuse" replace />;
  }

  if (doitChangerMdp) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/app" replace />;
}

// Garde pour "/login" et "/mot-de-passe-oublie" : évite d'afficher ces pages si déjà connecté
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
  const { session, profil, chargement, doitChangerMdp } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!aAccesAutorise(profil)) {
    return <Navigate to="/acces-refuse" replace />;
  }

  if (doitChangerMdp) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return children;
  }

  return <Navigate to="/app" replace />;
}

// Garde pour "/app" : réservée aux gérants et employés actifs d'une entreprise active
function RouteEntreprise({ children }) {
  const { session, profil, chargement, doitChangerMdp } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!aAccesAutorise(profil)) {
    return <Navigate to="/acces-refuse" replace />;
  }

  if (doitChangerMdp) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (estEntrepriseActive(profil)) {
    return children;
  }

  return <Navigate to="/admin" replace />;
}

// Garde pour "/changer-mot-de-passe" : réservée aux utilisateurs actifs avec doit_changer_mdp = true
function RouteChangerMotDePasse({ children }) {
  const { session, profil, chargement, doitChangerMdp } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!aAccesAutorise(profil)) {
    return <Navigate to="/acces-refuse" replace />;
  }

  if (!doitChangerMdp) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Garde pour "/acces-refuse" : uniquement pour un utilisateur connecté bloqué
function RouteAccesRefuse({ children }) {
  const { session, profil, chargement, doitChangerMdp } = useAuth();

  if (chargement) {
    return <EcranChargement />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!aAccesAutorise(profil)) {
    return children;
  }

  if (doitChangerMdp) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (estSuperAdminActif(profil)) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/app" replace />;
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
        path="/mot-de-passe-oublie"
        element={
          <RouteConnexion>
            <MotDePasseOublie />
          </RouteConnexion>
        }
      />
      {/* /reinitialisation n'est JAMAIS protégée ni redirigée par un garde,
          car le lien email connecte temporairement l'utilisateur en session de récupération */}
      <Route path="/reinitialisation" element={<Reinitialisation />} />
      <Route
        path="/changer-mot-de-passe"
        element={
          <RouteChangerMotDePasse>
            <ChangerMotDePasse />
          </RouteChangerMotDePasse>
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
