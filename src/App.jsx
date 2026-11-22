// Composant principal de l'application MiniGest
import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header.jsx';
import ClientForm from './components/ClientForm.jsx';
import SearchBar from './components/SearchBar.jsx';
import ClientList from './components/ClientList.jsx';
import { chargerClients, sauvegarderClients } from './utils/storage.js';

// Supprime les accents et met le texte en minuscules pour comparer facilement
function normaliserTexte(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function App() {
  // Charge la liste des clients depuis localStorage une seule fois au démarrage
  const [clients, setClients] = useState(() => chargerClients());

  // State contenant le texte tapé dans la barre de recherche
  const [recherche, setRecherche] = useState('');

  // Sauvegarde automatiquement dans localStorage à chaque modification de la liste
  useEffect(() => {
    sauvegarderClients(clients);
  }, [clients]);

  // Ajoute un nouveau client en lui générant un identifiant unique et la date d'ajout
  function ajouterClient(donneesClient) {
    const nouveauClient = {
      id: crypto.randomUUID(),
      ...donneesClient,
      dateAjout: new Date().toISOString(),
    };

    // On crée un nouveau tableau sans modifier le state directement
    setClients([...clients, nouveauClient]);
  }

  // Supprime le client correspondant à l'identifiant donné grâce à filter()
  function supprimerClient(id) {
    // filter() renvoie un nouveau tableau contenant tous les clients sauf celui à supprimer
    setClients(clients.filter((client) => client.id !== id));
  }

  // Calcul direct de la liste filtrée (valeur dérivée, pas besoin d'un second state)
  const rechercheNormalisee = normaliserTexte(recherche.trim());
  const enRecherche = rechercheNormalisee !== '';

  const clientsFiltres = enRecherche
    ? clients.filter((client) => {
        const nom = normaliserTexte(client.nom);
        const prenom = normaliserTexte(client.prenom);
        const telephone = normaliserTexte(client.telephone);

        return (
          nom.includes(rechercheNormalisee) ||
          prenom.includes(rechercheNormalisee) ||
          telephone.includes(rechercheNormalisee)
        );
      })
    : clients;

  return (
    <div className="app">
      {/* En-tête : affiche toujours le nombre TOTAL de clients */}
      <Header totalClients={clients.length} />

      {/* Formulaire d'ajout d'un nouveau client (reçoit clients pour vérifier l'unicité du téléphone) */}
      <ClientForm clients={clients} onAjouterClient={ajouterClient} />

      {/* Barre de recherche en temps réel */}
      <SearchBar
        recherche={recherche}
        onChangerRecherche={setRecherche}
        nbResultats={clientsFiltres.length}
        totalClients={clients.length}
      />

      {/* Tableau des clients (tous les clients, ou uniquement ceux qui correspondent à la recherche) */}
      <ClientList
        clients={clientsFiltres}
        enRecherche={enRecherche}
        onSupprimerClient={supprimerClient}
      />

      {/* Pied de page de l'application */}
      <footer className="footer">MiniGest v1.0 — Patrick Kassi</footer>
    </div>
  );
}

export default App;
