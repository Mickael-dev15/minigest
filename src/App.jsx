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

  // State contenant le client en cours de modification (null lorsqu'on est en mode ajout)
  const [clientEnEdition, setClientEnEdition] = useState(null);

  // State pour afficher le message de succès vert après un ajout ou une modification
  const [messageSucces, setMessageSucces] = useState('');

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
    setMessageSucces('Client ajouté avec succès');
  }

  // Passe le formulaire en mode modification pour le client sélectionné et remonte vers le formulaire
  function demarrerEdition(client) {
    setClientEnEdition(client);
    setMessageSucces('');

    const formulaire = document.getElementById('formulaire-client');
    if (formulaire) {
      formulaire.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Quitte le mode modification sans rien changer
  function annulerEdition() {
    setClientEnEdition(null);
    setMessageSucces('');
  }

  // Met à jour un seul client dans la liste grâce à map(), sans modifier le state directement
  function modifierClient(clientModifie) {
    setClients(
      clients.map((client) => {
        if (client.id === clientModifie.id) {
          // On remplace uniquement les champs modifiés tout en conservant l'id et la dateAjout d'origine
          return {
            ...client,
            ...clientModifie,
            id: client.id,
            dateAjout: client.dateAjout,
          };
        }
        return client;
      })
    );

    // Retourne au mode ajout avec le message de confirmation
    setClientEnEdition(null);
    setMessageSucces('Client modifié avec succès');
  }

  // Supprime le client correspondant à l'identifiant donné grâce à filter()
  function supprimerClient(id) {
    // filter() renvoie un nouveau tableau contenant tous les clients sauf celui à supprimer
    setClients(clients.filter((client) => client.id !== id));

    // Si le client supprimé était en cours de modification, on quitte le mode édition
    if (clientEnEdition && clientEnEdition.id === id) {
      setClientEnEdition(null);
      setMessageSucces('');
    }
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

      {/* Formulaire d'ajout ou de modification d'un client.
          La prop key permet à React de réinitialiser proprement les champs quand on change de client édité. */}
      <ClientForm
        key={clientEnEdition ? clientEnEdition.id : 'ajout'}
        clients={clients}
        clientEnEdition={clientEnEdition}
        messageSucces={messageSucces}
        onEffacerMessageSucces={() => setMessageSucces('')}
        onAjouterClient={ajouterClient}
        onModifierClient={modifierClient}
        onAnnulerEdition={annulerEdition}
      />

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
        idClientEnEdition={clientEnEdition ? clientEnEdition.id : null}
        onEditerClient={demarrerEdition}
        onSupprimerClient={supprimerClient}
      />

      {/* Pied de page de l'application */}
      <footer className="footer">MiniGest v1.1 — Patrick Kassi</footer>
    </div>
  );
}

export default App;
