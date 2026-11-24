-- ============================================================================
-- MiniGest v2 — Schéma de la base de données (Lot 1, étape 1)
-- ============================================================================
-- À exécuter EN PREMIER dans le SQL Editor de Supabase (projet minigest-dev).
-- Exécuter ensuite le fichier supabase/policies.sql pour activer la sécurité RLS.
--
-- Règle d'intégrité importante :
-- Aucune suppression en cascade (ON DELETE CASCADE) n'est utilisée sur les
-- entreprises. Toutes les clés étrangères utilisent ON DELETE RESTRICT afin
-- d'empêcher toute perte accidentelle de données liées à une entreprise.
-- ============================================================================

-- Extension nécessaire pour gen_random_uuid() (déjà active par défaut sur Supabase)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Table : entreprises
-- Stocke les sociétés clientes de la plateforme MiniGest v2.
-- ----------------------------------------------------------------------------
create table if not exists public.entreprises (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null,
  ville             text,
  pays              text,
  statut            text not null default 'active'
                      check (statut in ('active', 'suspendue')),
  motif_suspension  text,
  cree_le           timestamptz not null default now()
);

comment on table public.entreprises is
  'Entreprises abonnées à la plateforme MiniGest v2.';
comment on column public.entreprises.statut is
  'Statut du compte entreprise : active ou suspendue.';
comment on column public.entreprises.motif_suspension is
  'Raison éventuelle affichée lorsque l''entreprise est suspendue.';

-- ----------------------------------------------------------------------------
-- 2. Table : profils
-- Complète auth.users avec le rôle applicatif et le rattachement entreprise.
-- Un super_admin n'appartient à aucune entreprise (entreprise_id = NULL).
-- Un gérant ou un employé appartient obligatoirement à une entreprise.
-- ----------------------------------------------------------------------------
create table if not exists public.profils (
  id             uuid primary key references auth.users(id) on delete restrict,
  entreprise_id  uuid references public.entreprises(id) on delete restrict,
  nom_complet    text not null,
  role           text not null
                   check (role in ('super_admin', 'gerant', 'employe')),
  actif          boolean not null default true,

  -- Cohérence stricte entre le rôle et l'entreprise rattachée
  constraint profils_role_entreprise_check check (
    (role = 'super_admin' and entreprise_id is null)
    or (role in ('gerant', 'employe') and entreprise_id is not null)
  )
);

comment on table public.profils is
  'Profils applicatifs liés 1-à-1 avec auth.users (rôle, entreprise, état actif).';
comment on column public.profils.entreprise_id is
  'Identifiant de l''entreprise ; obligatoirement NULL pour le super_admin.';

create index if not exists idx_profils_entreprise_id
  on public.profils (entreprise_id);

-- ----------------------------------------------------------------------------
-- 3. Table : clients
-- Fiches clients propres à chaque entreprise (isolation stricte via RLS).
-- Le couple (entreprise_id, telephone) est unique pour éviter les doublons
-- au sein d'une même entreprise, tout en permettant à deux entreprises
-- différentes d'avoir le même numéro de téléphone dans leurs fichiers.
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null references public.entreprises(id) on delete restrict,
  nom            text not null,
  prenom         text not null,
  telephone      text not null,
  email          text,
  ville          text,
  statut         text not null default 'Client'
                   check (statut in ('Prospect', 'Client', 'Inactif')),
  note           text
                   check (note is null or char_length(note) <= 500),
  date_ajout     timestamptz not null default now(),
  cree_par       uuid references public.profils(id) on delete restrict,

  -- Unicité du numéro de téléphone à l'intérieur d'une même entreprise
  constraint clients_entreprise_telephone_unique unique (entreprise_id, telephone)
);

comment on table public.clients is
  'Fiches clients appartenant à chaque entreprise. Jamais lisibles par le super_admin.';
comment on column public.clients.note is
  'Note libre limitée à 500 caractères maximum.';

create index if not exists idx_clients_entreprise_id
  on public.clients (entreprise_id);

create index if not exists idx_clients_entreprise_date_ajout
  on public.clients (entreprise_id, date_ajout desc);

-- ----------------------------------------------------------------------------
-- 4. Table : abonnements
-- Suivi des formules, périodes et paiements (en FCFA) de chaque entreprise.
-- ----------------------------------------------------------------------------
create table if not exists public.abonnements (
  id               uuid primary key default gen_random_uuid(),
  entreprise_id    uuid not null references public.entreprises(id) on delete restrict,
  formule          text not null,
  date_debut       date not null,
  date_fin         date not null,
  montant_fcfa     integer not null check (montant_fcfa >= 0),
  statut_paiement  text not null default 'en_attente'
                     check (statut_paiement in ('paye', 'en_attente', 'en_retard')),
  reference        text,

  -- La date de fin doit être postérieure ou égale à la date de début
  constraint abonnements_dates_check check (date_fin >= date_debut)
);

comment on table public.abonnements is
  'Historique et suivi des abonnements des entreprises.';
comment on column public.abonnements.montant_fcfa is
  'Montant de l''abonnement exprimé en francs CFA (entier positif ou nul).';

create index if not exists idx_abonnements_entreprise_id
  on public.abonnements (entreprise_id);

-- ----------------------------------------------------------------------------
-- 5. Table : journal
-- Journal d'audit réservé au super_admin pour tracer les actions importantes.
-- ----------------------------------------------------------------------------
create table if not exists public.journal (
  id         uuid primary key default gen_random_uuid(),
  acteur_id  uuid references public.profils(id) on delete restrict,
  action     text not null,
  cible      text,
  details    jsonb not null default '{}'::jsonb,
  cree_le    timestamptz not null default now()
);

comment on table public.journal is
  'Journal d''audit des opérations d''administration (lecture réservée au super_admin).';

create index if not exists idx_journal_cree_le
  on public.journal (cree_le desc);

create index if not exists idx_journal_acteur_id
  on public.journal (acteur_id);

-- ============================================================================
-- COMMENT CRÉER MANUELLEMENT LE PREMIER SUPER_ADMIN DANS SUPABASE
-- ============================================================================
-- Comme les politiques RLS (supabase/policies.sql) interdisent toute création
-- de profil depuis l'application React, le tout premier super_admin doit être
-- créé manuellement dans la console Supabase :
--
-- Étape 1 : Créer le compte de connexion (Authentication)
--   1. Dans le tableau de bord Supabase, ouvre : Authentication > Users.
--   2. Clique sur "Add user" > "Create new user".
--   3. Saisis un email fictif (pour minigest-dev) et un mot de passe, puis
--      coche "Auto Confirm User" pour pouvoir te connecter immédiatement.
--   4. Une fois l'utilisateur créé, copie son "User UID" (format UUID).
--
-- Étape 2 : Créer son profil super_admin dans le SQL Editor
--   Le SQL Editor s'exécute avec le rôle administrateur PostgreSQL : il peut
--   donc insérer dans public.profils même avec RLS activée.
--   Décommente et exécute la requête ci-dessous en remplaçant les valeurs :
--
-- insert into public.profils (id, entreprise_id, nom_complet, role, actif)
-- values (
--   '00000000-0000-0000-0000-000000000000', -- <-- Remplacer par le User UID copié
--   null,                                   -- Toujours NULL pour un super_admin
--   'Admin MiniGest',                       -- Nom complet à afficher
--   'super_admin',
--   true
-- );
-- ============================================================================
