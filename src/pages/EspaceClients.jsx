// Espace clients (v1.8 déplacée telle quelle sur la route /app, toujours en localStorage pour cette étape)
import { useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import Dashboard from '../components/Dashboard.jsx';
import ClientForm from '../components/ClientForm.jsx';
import SearchBar from '../components/SearchBar.jsx';
import ClientList from '../components/ClientList.jsx';
import {
  chargerClients,
  sauvegarderClients,
  chargerVisibiliteDashboard,
  sauvegarderVisibiliteDashboard,
  chargerTri,
  sauvegarderTri,
  chargerParPage,
  sauvegarderParPage,
} from '../utils/storage.js';
import { validerClient } from '../utils/validation.js';
import {
  formaterTelephone,
  nettoyerRechercheTelephone,
} from '../utils/telephone.js';
import {
  exporterCSV,
  importerCSV,
  obtenirNomFichierExport,
} from '../utils/csv.js';
import {
  calculerProchainTri,
  normaliserTri,
  trierClients,
} from '../utils/tri.js';
import { normaliserParPage, paginer } from '../utils/pagination.js';

// Supprime les accents et met le texte en minuscules pour comparer facilement
function normaliserTexte(texte) {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Applique la recherche texte puis le filtre par statut, sans modifier la liste d'origine
function filtrerClients(listeClients, recherche, filtreStatut) {
  const rechercheNormalisee = normaliserTexte(recherche.trim());
  const rechercheTelephone = nettoyerRechercheTelephone(recherche);
  const enRecherche = rechercheNormalisee !== '';

  return listeClients.filter((client) => {
    // 1. Recherche texte (nom, prénom, téléphone ou note)
    if (enRecherche) {
      const nom = normaliserTexte(client.nom);
      const prenom = normaliserTexte(client.prenom);
      const telephone = normaliserTexte(client.telephone);
      const telephoneFormate = normaliserTexte(
        formaterTelephone(client.telephone)
      );
      const telephoneSansSeparateurs = String(client.telephone ?? '').replace(
        /[\s.\-()]/g,
        ''
      );
      const note = normaliserTexte(client.note ?? '');

      const correspondTelephone =
        telephone.includes(rechercheNormalisee) ||
        telephoneFormate.includes(rechercheNormalisee) ||
        (rechercheTelephone !== '' &&
          telephoneSansSeparateurs.includes(rechercheTelephone));

      const correspondRecherche =
        nom.includes(rechercheNormalisee) ||
        prenom.includes(rechercheNormalisee) ||
        correspondTelephone ||
        note.includes(rechercheNormalisee);

      if (!correspondRecherche) {
        return false;
      }
    }

    // 2. Filtre par statut
    if (filtreStatut !== 'Tous' && client.statut !== filtreStatut) {
      return false;
    }

    return true;
  });
}

function EspaceClients() {
  // Charge la liste des clients depuis localStorage une seule fois au démarrage
  const [clients, setClients] = useState(() => chargerClients());

  // State contenant le texte tapé dans la barre de recherche
  const [recherche, setRecherche] = useState('');

  // State contenant le filtre de statut actif ("Tous", "Prospect", "Client" ou "Inactif")
  const [filtreStatut, setFiltreStatut] = useState('Tous');

  // State contenant le client en cours de modification (null lorsqu'on est en mode ajout)
  const [clientEnEdition, setClientEnEdition] = useState(null);

  // State pour afficher le message de succès vert après un ajout ou une modification
  const [messageSucces, setMessageSucces] = useState('');

  // State pour afficher le bilan (ou l'erreur) après un import CSV
  const [bilanImport, setBilanImport] = useState(null);

  // State pour afficher ou masquer le tableau de bord (mémorisé dans localStorage)
  const [dashboardVisible, setDashboardVisible] = useState(() =>
    chargerVisibiliteDashboard()
  );

  // State pour mémoriser la colonne et le sens de tri actifs (mémorisé dans localStorage)
  const [tri, setTri] = useState(() => chargerTri());

  // State pour le nombre de clients affichés par page (mémorisé dans localStorage, 10 par défaut)
  const [parPage, setParPage] = useState(() => chargerParPage());

  // State pour la page courante (non mémorisé : on revient toujours en page 1 à l'ouverture)
  const [pageCourante, setPageCourante] = useState(1);

  // Sauvegarde automatiquement dans localStorage à chaque modification de la liste
  useEffect(() => {
    sauvegarderClients(clients);
  }, [clients]);

  // Mémorise automatiquement le choix d'affichage du tableau de bord
  useEffect(() => {
    sauvegarderVisibiliteDashboard(dashboardVisible);
  }, [dashboardVisible]);

  // Mémorise automatiquement le choix de tri dans localStorage
  useEffect(() => {
    sauvegarderTri(tri);
  }, [tri]);

  // Mémorise automatiquement le nombre de clients par page dans localStorage
  useEffect(() => {
    sauvegarderParPage(parPage);
  }, [parPage]);

  // Met à jour la recherche et revient directement à la page 1
  function gererChangementRecherche(nouvelleRecherche) {
    setRecherche(nouvelleRecherche);
    setPageCourante(1);
  }

  // Met à jour le filtre de statut et revient directement à la page 1
  function gererChangementFiltreStatut(nouveauStatut) {
    setFiltreStatut(nouveauStatut);
    setPageCourante(1);
  }

  // Change le tri lors d'un clic sur un en-tête de colonne du tableau et revient à la page 1
  function gererTriColonne(colonne) {
    setTri((triActuel) => calculerProchainTri(triActuel, colonne));
    setPageCourante(1);
  }

  // Applique directement un tri choisi dans la liste déroulante mobile et revient à la page 1
  function gererSelectionTri(nouveauTri) {
    setTri(normaliserTri(nouveauTri));
    setPageCourante(1);
  }

  // Change le nombre de clients affichés par page et revient directement à la page 1
  function gererChangementParPage(nouveauParPage) {
    setParPage(normaliserParPage(nouveauParPage));
    setPageCourante(1);
  }

  // Ajoute un nouveau client en lui générant un identifiant unique et la date d'ajout,
  // puis affiche directement la page où ce nouveau client apparaît
  function ajouterClient(donneesClient) {
    const nouveauClient = {
      id: crypto.randomUUID(),
      ...donneesClient,
      dateAjout: new Date().toISOString(),
    };

    // On crée un nouveau tableau sans modifier le state directement
    const nouvelleListe = [...clients, nouveauClient];
    setClients(nouvelleListe);

    // Si le nouveau client ne correspond pas au filtre de statut actif, on repasse sur "Tous" pour le rendre visible
    const nouveauFiltreStatut =
      filtreStatut !== 'Tous' && nouveauClient.statut !== filtreStatut
        ? 'Tous'
        : filtreStatut;

    if (nouveauFiltreStatut !== filtreStatut) {
      setFiltreStatut(nouveauFiltreStatut);
    }

    // Calcule la position du client ajouté après recherche, filtre et tri pour aller sur sa page
    const listeFiltree = filtrerClients(
      nouvelleListe,
      recherche,
      nouveauFiltreStatut
    );
    const listeTriee = trierClients(listeFiltree, tri);
    const indexNouveauClient = listeTriee.findIndex(
      (client) => client.id === nouveauClient.id
    );

    if (indexNouveauClient !== -1) {
      const pageDuNouveauClient = Math.floor(indexNouveauClient / parPage) + 1;
      setPageCourante(pageDuNouveauClient);
    }

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
    const nouvelleListe = clients.map((client) => {
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
    });

    setClients(nouvelleListe);

    // Si le client modifié ne correspond plus au filtre de statut actif, on repasse sur "Tous" pour le garder visible
    const nouveauFiltreStatut =
      filtreStatut !== 'Tous' && clientModifie.statut !== filtreStatut
        ? 'Tous'
        : filtreStatut;

    if (nouveauFiltreStatut !== filtreStatut) {
      setFiltreStatut(nouveauFiltreStatut);
    }

    // Si la page courante n'existe plus après modification (ex. recherche active), on recale sur la dernière page
    const listeFiltreeApresModif = filtrerClients(
      nouvelleListe,
      recherche,
      nouveauFiltreStatut
    );
    const nouveauTotalPages = Math.max(
      1,
      Math.ceil(listeFiltreeApresModif.length / parPage)
    );
    if (pageCourante > nouveauTotalPages) {
      setPageCourante(nouveauTotalPages);
    }

    // Retourne au mode ajout avec le message de confirmation
    setClientEnEdition(null);
    setMessageSucces('Client modifié avec succès');
  }

  // Supprime le client correspondant à l'identifiant donné grâce à filter()
  function supprimerClient(id) {
    // filter() renvoie un nouveau tableau contenant tous les clients sauf celui à supprimer
    const nouvelleListe = clients.filter((client) => client.id !== id);
    setClients(nouvelleListe);

    // Si la page courante n'existe plus (ex. suppression du dernier client de la dernière page),
    // on revient automatiquement à la dernière page existante
    const listeFiltreeApresSuppression = filtrerClients(
      nouvelleListe,
      recherche,
      filtreStatut
    );
    const nouveauTotalPages = Math.max(
      1,
      Math.ceil(listeFiltreeApresSuppression.length / parPage)
    );
    if (pageCourante > nouveauTotalPages) {
      setPageCourante(nouveauTotalPages);
    }

    // Si le client supprimé était en cours de modification, on quitte le mode édition
    if (clientEnEdition && clientEnEdition.id === id) {
      setClientEnEdition(null);
      setMessageSucces('');
    }
  }

  // Exporte tous les clients enregistrés dans un fichier CSV téléchargé par le navigateur
  function exporterClientsCSV() {
    if (clients.length === 0) {
      return;
    }

    const contenuCSV = exporterCSV(clients);
    const fichierBlob = new Blob([contenuCSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(fichierBlob);

    const lien = document.createElement('a');
    lien.href = url;
    lien.download = obtenirNomFichierExport();
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  // Lit un fichier CSV choisi par l'utilisateur, valide chaque ligne et ajoute les clients valides
  function importerClientsCSV(fichier) {
    if (!fichier) {
      return;
    }

    const lecteur = new FileReader();

    lecteur.onerror = () => {
      setBilanImport({
        erreur:
          "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier CSV valide.",
        nbImportes: 0,
        lignesIgnorees: [],
        avertissements: [],
      });
    };

    lecteur.onload = () => {
      const texte = typeof lecteur.result === 'string' ? lecteur.result : '';
      const resultat = importerCSV(texte);

      // Si le fichier est vide, illisible ou n'a pas les bonnes colonnes, on ne modifie rien
      if (resultat.erreur) {
        setBilanImport({
          erreur: resultat.erreur,
          nbImportes: 0,
          lignesIgnorees: [],
          avertissements: [],
        });
        return;
      }

      // Copie de référence pour détecter les doublons aussi bien avec la liste existante qu'au sein du fichier
      const clientsDeReference = [...clients];
      const nouveauxClients = [];
      const lignesIgnorees = [];
      const avertissements = [];

      for (const ligne of resultat.lignes) {
        if (ligne.tropDeColonnes) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: `Nombre de colonnes incorrect (${ligne.nbColonnesAttendues} colonnes attendues)`,
          });
          continue;
        }

        if (ligne.telephoneAbimeExcel) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: 'Téléphone abîmé par Excel : ressaisir le numéro',
          });
          continue;
        }

        // Chaque ligne passe par la même fonction validerClient que le formulaire
        const { erreurs, donneesPropres } = validerClient(
          ligne,
          clientsDeReference
        );
        const messagesErreurs = Object.values(erreurs);

        if (messagesErreurs.length > 0) {
          lignesIgnorees.push({
            numeroLigne: ligne.numeroLigne,
            raison: messagesErreurs.join(' ; '),
          });
          continue;
        }

        // Si le statut du CSV était inconnu, on a appliqué "Client" par défaut et on le signale dans le bilan
        if (ligne.statutInconnu) {
          avertissements.push({
            numeroLigne: ligne.numeroLigne,
            message: 'statut inconnu, Client par défaut',
          });
        }

        const nouveauClient = {
          id: crypto.randomUUID(),
          ...donneesPropres,
          dateAjout: ligne.dateAjout,
        };

        nouveauxClients.push(nouveauClient);
        clientsDeReference.push(nouveauClient);
      }

      // On ajoute les clients importés à la liste existante sans jamais remplacer ni modifier le state directement
      if (nouveauxClients.length > 0) {
        setClients([...clients, ...nouveauxClients]);
      }

      setBilanImport({
        erreur: null,
        nbImportes: nouveauxClients.length,
        lignesIgnorees,
        avertissements,
      });
    };

    lecteur.readAsText(fichier, 'UTF-8');
  }

  // Détecte les éventuels doublons de téléphone (ex. apparus après migration) sans rien supprimer
  const groupesParTelephone = {};
  for (const client of clients) {
    const cleTelephone = String(client.telephone ?? '').trim();
    if (cleTelephone === '') {
      continue;
    }
    if (!groupesParTelephone[cleTelephone]) {
      groupesParTelephone[cleTelephone] = [];
    }
    groupesParTelephone[cleTelephone].push(client);
  }

  const doublonsTelephone = Object.entries(groupesParTelephone)
    .filter(([, liste]) => liste.length > 1)
    .map(([numero, liste]) => ({
      numero,
      clients: liste,
    }));

  // Compteurs par statut calculés directement à partir de la liste des clients (valeurs dérivées, aucun state en plus)
  const compteursStatut = {
    Tous: clients.length,
    Prospect: clients.filter((client) => client.statut === 'Prospect').length,
    Client: clients.filter((client) => client.statut === 'Client').length,
    Inactif: clients.filter((client) => client.statut === 'Inactif').length,
  };

  // Chaîne complète sans modifier "clients" : recherche → filtre statut → tri → pagination
  const enRecherche = normaliserTexte(recherche.trim()) !== '';
  const clientsFiltres = filtrerClients(clients, recherche, filtreStatut);
  const clientsTries = trierClients(clientsFiltres, tri);
  const pagination = paginer(clientsTries, pageCourante, parPage);

  return (
    <div className="app">
      {/* En-tête : affiche toujours le nombre TOTAL de clients */}
      <Header totalClients={clients.length} />

      {/* Bandeau d'alerte orange si des doublons de téléphone existent (aucune suppression automatique) */}
      {doublonsTelephone.length > 0 && (
        <section className="duplicate-banner" role="alert">
          <p className="duplicate-banner-title">
            {doublonsTelephone.length} doublon(s) de téléphone détecté(s)
          </p>
          <p className="duplicate-banner-text">
            Aucun client n&apos;a été supprimé. Modifiez ou supprimez les fiches
            concernées ci-dessous :
          </p>
          <ul className="duplicate-banner-list">
            {doublonsTelephone.map((groupe) => (
              <li key={groupe.numero}>
                <strong>{formaterTelephone(groupe.numero)}</strong> :{' '}
                {groupe.clients
                  .map((client) => `${client.nom} ${client.prenom}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tableau de bord d'activité : calculé sur TOUS les clients, sans tenir compte du filtre ni de la recherche */}
      <Dashboard
        clients={clients}
        estVisible={dashboardVisible}
        onBasculerVisibilite={() => setDashboardVisible((visible) => !visible)}
      />

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
        onChangerRecherche={gererChangementRecherche}
        nbResultats={clientsFiltres.length}
        totalClients={clients.length}
        filtreStatut={filtreStatut}
      />

      {/* Tableau des clients (recherchés, filtrés, triés puis paginés) */}
      <ClientList
        clients={pagination.elements}
        totalClients={clients.length}
        totalClientsFiltres={clientsTries.length}
        debutPagination={pagination.debut}
        finPagination={pagination.fin}
        pageCourante={pagination.pageCourante}
        totalPages={pagination.totalPages}
        parPage={parPage}
        onChangerPage={setPageCourante}
        onChangerParPage={gererChangementParPage}
        enRecherche={enRecherche}
        filtreStatut={filtreStatut}
        compteursStatut={compteursStatut}
        onChangerFiltreStatut={gererChangementFiltreStatut}
        tri={tri}
        onTrierColonne={gererTriColonne}
        onChangerTri={gererSelectionTri}
        idClientEnEdition={clientEnEdition ? clientEnEdition.id : null}
        bilanImport={bilanImport}
        onEditerClient={demarrerEdition}
        onSupprimerClient={supprimerClient}
        onExporterCSV={exporterClientsCSV}
        onImporterCSV={importerClientsCSV}
        onFermerBilanImport={() => setBilanImport(null)}
      />

      {/* Pied de page de l'application */}
      <footer className="footer">MiniGest v1.8 — Patrick Kassi</footer>
    </div>
  );
}

export default EspaceClients;
