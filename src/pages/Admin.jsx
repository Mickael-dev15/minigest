// Tableau de bord Super admin (/admin) — Lot 2a.
// IMPORTANT : cette page ne lit JAMAIS public.clients ; elle utilise uniquement
// le RPC nb_clients_par_entreprise pour le comptage par entreprise.
import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header.jsx';
import AdminKpis from '../components/AdminKpis.jsx';
import EntrepriseForm from '../components/EntrepriseForm.jsx';
import EntreprisesTable from '../components/EntreprisesTable.jsx';
import AbonnementsPanel from '../components/AbonnementsPanel.jsx';
import JournalSection from '../components/JournalSection.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/useAuth.js';
import {
  calculerIndicateursAdmin,
  construireCarteNbClients,
  regrouperAbonnementsParEntreprise,
} from '../utils/admin.js';

const COLONNES_ENTREPRISE =
  'id, nom, ville, pays, statut, motif_suspension, cree_le';
const COLONNES_ABONNEMENT =
  'id, entreprise_id, formule, date_debut, date_fin, montant_fcfa, statut_paiement, reference';
const COLONNES_JOURNAL =
  'id, acteur_id, action, cible, details, cree_le, acteur:profils ( nom_complet )';

// Traduit les erreurs Supabase courantes en messages français clairs
function traduireErreurAdmin(erreur, messageParDefaut) {
  if (!erreur) {
    return messageParDefaut;
  }

  if (erreur.code === '42501') {
    return 'Action non autorisée';
  }

  if (erreur.code === '23514') {
    return 'Données invalides (vérifiez les dates ou le montant).';
  }

  return messageParDefaut;
}

function Admin() {
  const { session, profil, chargement: chargementProfil } = useAuth();

  // Vérifie que la session et le profil super_admin sont prêts avant tout appel Supabase
  const superAdminPret =
    !chargementProfil &&
    Boolean(session?.user?.id) &&
    profil?.role === 'super_admin' &&
    Boolean(profil?.actif);

  // Données chargées depuis Supabase
  const [entreprises, setEntreprises] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [lignesRpcClients, setLignesRpcClients] = useState([]);
  const [journal, setJournal] = useState([]);

  // États de chargement initial et d'erreur globale
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const [compteurRechargement, setCompteurRechargement] = useState(0);

  // Bandeaux de retour utilisateur
  const [messageSucces, setMessageSucces] = useState('');
  const [avertissementJournal, setAvertissementJournal] = useState('');
  const [erreurAction, setErreurAction] = useState('');
  const [erreurCreation, setErreurCreation] = useState('');
  const [erreurAbonnement, setErreurAbonnement] = useState('');

  // États "en cours" pour désactiver les boutons et éviter les doubles clics
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [actionEntrepriseId, setActionEntrepriseId] = useState(null);
  const [enregistrementAbonnement, setEnregistrementAbonnement] =
    useState(false);

  // Entreprise actuellement ouverte dans le panneau Abonnements (null si fermé)
  const [entrepriseSelectionneeId, setEntrepriseSelectionneeId] =
    useState(null);

  // Charge les 4 sources de données en parallèle (sans jamais lire public.clients)
  const recupererDonneesAdmin = useCallback(async () => {
    const [resEntreprises, resAbonnements, resRpcClients, resJournal] =
      await Promise.all([
        supabase
          .from('entreprises')
          .select(COLONNES_ENTREPRISE)
          .order('cree_le', { ascending: false }),
        supabase
          .from('abonnements')
          .select(COLONNES_ABONNEMENT)
          .order('date_fin', { ascending: false }),
        supabase.rpc('nb_clients_par_entreprise'),
        supabase
          .from('journal')
          .select(COLONNES_JOURNAL)
          .order('cree_le', { ascending: false })
          .limit(20),
      ]);

    const premiereErreur =
      resEntreprises.error ||
      resAbonnements.error ||
      resRpcClients.error ||
      resJournal.error;

    if (premiereErreur) {
      return { erreur: premiereErreur };
    }

    return {
      erreur: null,
      entreprises: resEntreprises.data ?? [],
      abonnements: resAbonnements.data ?? [],
      lignesRpcClients: resRpcClients.data ?? [],
      journal: resJournal.data ?? [],
    };
  }, []);

  // Chargement initial dès que le profil super_admin est prêt
  useEffect(() => {
    if (!superAdminPret) {
      return;
    }

    let estActif = true;

    async function chargerInitial() {
      setChargementDonnees(true);
      setErreurChargement('');

      try {
        const resultat = await recupererDonneesAdmin();
        if (!estActif) {
          return;
        }

        if (resultat.erreur) {
          setErreurChargement(
            traduireErreurAdmin(
              resultat.erreur,
              'Impossible de charger les données du tableau de bord. Veuillez réessayer.'
            )
          );
        } else {
          setEntreprises(resultat.entreprises);
          setAbonnements(resultat.abonnements);
          setLignesRpcClients(resultat.lignesRpcClients);
          setJournal(resultat.journal);
        }
      } catch {
        if (!estActif) {
          return;
        }
        setErreurChargement(
          'Erreur réseau lors du chargement du tableau de bord. Vérifiez votre connexion.'
        );
      } finally {
        if (estActif) {
          setChargementDonnees(false);
        }
      }
    }

    chargerInitial();

    return () => {
      estActif = false;
    };
  }, [superAdminPret, profil?.id, compteurRechargement, recupererDonneesAdmin]);

  // Recharge silencieusement les indicateurs, tableaux et journal après chaque action
  async function rechargerDonneesSilencieusement() {
    try {
      const resultat = await recupererDonneesAdmin();
      if (!resultat.erreur) {
        setEntreprises(resultat.entreprises);
        setAbonnements(resultat.abonnements);
        setLignesRpcClients(resultat.lignesRpcClients);
        setJournal(resultat.journal);
      }
    } catch {
      // L'état local a déjà été mis à jour ; on ne bloque pas l'utilisateur
    }
  }

  // Insère une ligne dans public.journal. Si cela échoue, l'action principale reste validée
  // et un avertissement dédié est affiché.
  async function enregistrerDansJournal(action, cible, details) {
    try {
      const { error } = await supabase.from('journal').insert({
        acteur_id: session.user.id,
        action,
        cible,
        details: details ?? {},
      });

      if (error) {
        setAvertissementJournal(
          'Action effectuée, mais non enregistrée dans le journal'
        );
        return false;
      }

      return true;
    } catch {
      setAvertissementJournal(
        'Action effectuée, mais non enregistrée dans le journal'
      );
      return false;
    }
  }

  // Réinitialise les messages de retour avant de lancer une nouvelle action
  function reinitialiserMessages() {
    setMessageSucces('');
    setAvertissementJournal('');
    setErreurAction('');
    setErreurCreation('');
    setErreurAbonnement('');
  }

  // 1. Création d'une nouvelle entreprise
  async function creerEntreprise(donneesPropres) {
    if (!superAdminPret || creationEnCours) {
      return false;
    }

    reinitialiserMessages();
    setCreationEnCours(true);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .insert({
          nom: donneesPropres.nom,
          ville: donneesPropres.ville,
          pays: donneesPropres.pays,
        })
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurCreation(
          traduireErreurAdmin(
            error,
            "Impossible de créer l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurCreation('Action non autorisée');
        return false;
      }

      const nouvelleEntreprise = data[0];
      setEntreprises((listeActuelle) => [nouvelleEntreprise, ...listeActuelle]);

      await enregistrerDansJournal(
        'creation_entreprise',
        nouvelleEntreprise.nom,
        {
          entreprise_id: nouvelleEntreprise.id,
          ville: nouvelleEntreprise.ville,
          pays: nouvelleEntreprise.pays,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(
        `Entreprise « ${nouvelleEntreprise.nom} » créée avec succès.`
      );
      return true;
    } catch {
      setErreurCreation(
        "Erreur réseau lors de la création de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setCreationEnCours(false);
    }
  }

  // 2. Suspension d'une entreprise (motif obligatoire déjà validé)
  async function suspendreEntreprise(entreprise, motifPropre) {
    if (!superAdminPret || actionEntrepriseId !== null) {
      return false;
    }

    reinitialiserMessages();
    setActionEntrepriseId(entreprise.id);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .update({
          statut: 'suspendue',
          motif_suspension: motifPropre,
        })
        .eq('id', entreprise.id)
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurAction(
          traduireErreurAdmin(
            error,
            "Impossible de suspendre l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return false;
      }

      const entrepriseMiseAJour = data[0];
      setEntreprises((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === entrepriseMiseAJour.id ? entrepriseMiseAJour : item
        )
      );

      await enregistrerDansJournal(
        'suspension_entreprise',
        entrepriseMiseAJour.nom,
        {
          entreprise_id: entrepriseMiseAJour.id,
          motif: motifPropre,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Entreprise « ${entrepriseMiseAJour.nom} » suspendue.`);
      return true;
    } catch {
      setErreurAction(
        "Erreur réseau lors de la suspension de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionEntrepriseId(null);
    }
  }

  // 3. Réactivation d'une entreprise (remet motif_suspension à null)
  async function reactiverEntreprise(entreprise) {
    if (!superAdminPret || actionEntrepriseId !== null) {
      return false;
    }

    reinitialiserMessages();
    setActionEntrepriseId(entreprise.id);

    try {
      const { data, error } = await supabase
        .from('entreprises')
        .update({
          statut: 'active',
          motif_suspension: null,
        })
        .eq('id', entreprise.id)
        .select(COLONNES_ENTREPRISE);

      if (error) {
        setErreurAction(
          traduireErreurAdmin(
            error,
            "Impossible de réactiver l'entreprise. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAction('Action non autorisée');
        return false;
      }

      const entrepriseMiseAJour = data[0];
      setEntreprises((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === entrepriseMiseAJour.id ? entrepriseMiseAJour : item
        )
      );

      await enregistrerDansJournal(
        'reactivation_entreprise',
        entrepriseMiseAJour.nom,
        {
          entreprise_id: entrepriseMiseAJour.id,
          ancien_motif: entreprise.motif_suspension ?? null,
        }
      );

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Entreprise « ${entrepriseMiseAJour.nom} » réactivée.`);
      return true;
    } catch {
      setErreurAction(
        "Erreur réseau lors de la réactivation de l'entreprise. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setActionEntrepriseId(null);
    }
  }

  // 4. Ajout d'un abonnement pour une entreprise
  async function ajouterAbonnement(entreprise, donneesPropres) {
    if (!superAdminPret || enregistrementAbonnement) {
      return false;
    }

    reinitialiserMessages();
    setEnregistrementAbonnement(true);

    try {
      const { data, error } = await supabase
        .from('abonnements')
        .insert({
          entreprise_id: entreprise.id,
          formule: donneesPropres.formule,
          date_debut: donneesPropres.date_debut,
          date_fin: donneesPropres.date_fin,
          montant_fcfa: donneesPropres.montant_fcfa,
          statut_paiement: donneesPropres.statut_paiement,
          reference: donneesPropres.reference,
        })
        .select(COLONNES_ABONNEMENT);

      if (error) {
        setErreurAbonnement(
          traduireErreurAdmin(
            error,
            "Impossible d'ajouter l'abonnement. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAbonnement('Action non autorisée');
        return false;
      }

      const nouvelAbonnement = data[0];
      setAbonnements((listeActuelle) => [nouvelAbonnement, ...listeActuelle]);

      await enregistrerDansJournal('creation_abonnement', entreprise.nom, {
        entreprise_id: entreprise.id,
        abonnement_id: nouvelAbonnement.id,
        formule: nouvelAbonnement.formule,
        date_debut: nouvelAbonnement.date_debut,
        date_fin: nouvelAbonnement.date_fin,
        montant_fcfa: nouvelAbonnement.montant_fcfa,
        statut_paiement: nouvelAbonnement.statut_paiement,
        reference: nouvelAbonnement.reference,
      });

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Abonnement ajouté pour « ${entreprise.nom} ».`);
      return true;
    } catch {
      setErreurAbonnement(
        "Erreur réseau lors de l'ajout de l'abonnement. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setEnregistrementAbonnement(false);
    }
  }

  // 5. Modification d'un abonnement existant
  async function modifierAbonnement(entreprise, abonnementId, donneesPropres) {
    if (!superAdminPret || enregistrementAbonnement) {
      return false;
    }

    reinitialiserMessages();
    setEnregistrementAbonnement(true);

    try {
      const { data, error } = await supabase
        .from('abonnements')
        .update({
          formule: donneesPropres.formule,
          date_debut: donneesPropres.date_debut,
          date_fin: donneesPropres.date_fin,
          montant_fcfa: donneesPropres.montant_fcfa,
          statut_paiement: donneesPropres.statut_paiement,
          reference: donneesPropres.reference,
        })
        .eq('id', abonnementId)
        .select(COLONNES_ABONNEMENT);

      if (error) {
        setErreurAbonnement(
          traduireErreurAdmin(
            error,
            "Impossible de modifier l'abonnement. Veuillez réessayer."
          )
        );
        return false;
      }

      if (!data || data.length === 0) {
        setErreurAbonnement('Action non autorisée');
        return false;
      }

      const abonnementMisAJour = data[0];
      setAbonnements((listeActuelle) =>
        listeActuelle.map((item) =>
          item.id === abonnementMisAJour.id ? abonnementMisAJour : item
        )
      );

      await enregistrerDansJournal('modification_abonnement', entreprise.nom, {
        entreprise_id: entreprise.id,
        abonnement_id: abonnementMisAJour.id,
        formule: abonnementMisAJour.formule,
        date_debut: abonnementMisAJour.date_debut,
        date_fin: abonnementMisAJour.date_fin,
        montant_fcfa: abonnementMisAJour.montant_fcfa,
        statut_paiement: abonnementMisAJour.statut_paiement,
        reference: abonnementMisAJour.reference,
      });

      await rechargerDonneesSilencieusement();
      setMessageSucces(`Abonnement modifié pour « ${entreprise.nom} ».`);
      return true;
    } catch {
      setErreurAbonnement(
        "Erreur réseau lors de la modification de l'abonnement. Vérifiez votre connexion."
      );
      return false;
    } finally {
      setEnregistrementAbonnement(false);
    }
  }

  // Ouvre la section Abonnements de l'entreprise cliquée et fait défiler jusqu'à elle
  function ouvrirAbonnements(entreprise) {
    setErreurAbonnement('');
    setEntrepriseSelectionneeId(entreprise.id);

    setTimeout(() => {
      const section = document.getElementById('section-abonnements');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  // Calculs dérivés effectués uniquement par des fonctions pures de src/utils/admin.js
  const indicateurs = calculerIndicateursAdmin(
    entreprises,
    abonnements,
    lignesRpcClients
  );
  const carteNbClients = construireCarteNbClients(lignesRpcClients);
  const abonnementsParEntreprise =
    regrouperAbonnementsParEntreprise(abonnements);
  const entrepriseSelectionnee =
    entreprises.find((e) => e.id === entrepriseSelectionneeId) ?? null;
  const abonnementsEntrepriseSelectionnee = entrepriseSelectionnee
    ? (abonnementsParEntreprise[entrepriseSelectionnee.id] ?? [])
    : [];

  return (
    <div className="app">
      <Header />

      {chargementDonnees ? (
        <section
          className="card clients-status-card"
          role="status"
          aria-live="polite"
        >
          <p className="clients-loading-text">
            Chargement du tableau de bord Super admin...
          </p>
        </section>
      ) : erreurChargement ? (
        <section className="card clients-status-card" role="alert">
          <p className="action-error-text">{erreurChargement}</p>
          <div className="clients-retry-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCompteurRechargement((c) => c + 1)}
            >
              Réessayer
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Bandeaux de retour après une action (succès, avertissement journal, erreur) */}
          {messageSucces && (
            <div className="success-message" role="status" aria-live="polite">
              {messageSucces}
            </div>
          )}

          {avertissementJournal && (
            <div className="import-report import-report-warning" role="status">
              <div className="import-report-header">
                <p className="import-report-summary">{avertissementJournal}</p>
                <button
                  type="button"
                  className="btn-close-report"
                  onClick={() => setAvertissementJournal('')}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {erreurAction && (
            <div className="action-error-banner" role="alert">
              <p className="action-error-text">{erreurAction}</p>
              <button
                type="button"
                className="btn-close-report"
                onClick={() => setErreurAction('')}
              >
                Fermer
              </button>
            </div>
          )}

          {/* 1. Indicateurs clés en haut */}
          <AdminKpis indicateurs={indicateurs} />

          {/* 2. Formulaire de création d'entreprise */}
          <EntrepriseForm
            onCreerEntreprise={creerEntreprise}
            enCours={creationEnCours}
            erreurServeur={erreurCreation}
          />

          {/* 3. Tableau des entreprises + suspension / réactivation */}
          <EntreprisesTable
            entreprises={entreprises}
            carteNbClients={carteNbClients}
            abonnementsParEntreprise={abonnementsParEntreprise}
            entrepriseSelectionneeId={entrepriseSelectionneeId}
            onSelectionnerAbonnements={ouvrirAbonnements}
            onSuspendreEntreprise={suspendreEntreprise}
            onReactiverEntreprise={reactiverEntreprise}
            actionEnCoursId={actionEntrepriseId}
          />

          {/* 4. Panneau des abonnements de l'entreprise sélectionnée */}
          {entrepriseSelectionnee && (
            <AbonnementsPanel
              key={entrepriseSelectionnee.id}
              entreprise={entrepriseSelectionnee}
              abonnements={abonnementsEntrepriseSelectionnee}
              onAjouterAbonnement={ajouterAbonnement}
              onModifierAbonnement={modifierAbonnement}
              onFermer={() => {
                setEntrepriseSelectionneeId(null);
                setErreurAbonnement('');
              }}
              enCours={enregistrementAbonnement}
              erreurServeur={erreurAbonnement}
            />
          )}

          {/* 5. Dernières actions (20 plus récentes du journal) */}
          <JournalSection entrees={journal} />
        </>
      )}

      <footer className="footer">MiniGest v2 — Administration</footer>
    </div>
  );
}

export default Admin;
