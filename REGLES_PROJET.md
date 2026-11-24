# Règles du projet MiniGest v2

## Contexte
MiniGest v2 est une plateforme multi-entreprises de gestion de clients.
Rôles : super_admin (un seul pour l'instant), gerant, employe.
Chaque entreprise ne voit QUE ses propres clients. Le super_admin voit les entreprises,
les abonnements et le NOMBRE de clients par entreprise, jamais le détail des clients.
Cahier des charges : MiniGest v2, validé le 24/11/2026. On travaille lot par lot.
Le développeur est débutant : explique chaque étape simplement, en français.

## Technique
- React 19 + Vite, JavaScript, React Router, @supabase/supabase-js.
- Base de données : Supabase (PostgreSQL) avec Row Level Security (RLS).
- On réutilise les composants et les fonctions pures de la v1.8 (src/utils).

## Sécurité (règles absolues)
- Le code React n'utilise QUE import.meta.env.VITE_SUPABASE_URL et
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY.
- Ne JAMAIS écrire, demander ou utiliser la clé secret / service_role dans src/,
  dans un fichier suivi par Git ou dans la conversation.
- Ne jamais afficher ni modifier .env.local.
- RLS activée sur TOUTES les tables. La sécurité est garantie par la base,
  jamais seulement par l'interface React.
- Données fictives uniquement dans minigest-dev.

## Base de données
- Les scripts SQL sont écrits dans supabase/*.sql, commentés en français.
- Tu ne les exécutes pas toi-même : je les exécute dans le SQL Editor de Supabase
  après les avoir relus. Explique chaque partie avant.

## Git
- Travailler uniquement sur la branche v2. Ne jamais faire de commit ni de push sur main.

## Méthode de travail
- Avant de coder, présente un plan court et attends ma validation.
- Une fonctionnalité à la fois. Code commenté en français.
- Ne modifie jamais le state directement.
- Après chaque étape, dis-moi comment tester.