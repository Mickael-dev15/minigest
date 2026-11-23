// Composant de pagination affiché sous la liste des clients :
// - texte récapitulatif ("Affichage 11–20 sur 41 clients")
// - choix du nombre de clients par page ("Afficher : 10 / 25 / 50")
// - boutons "Précédent", numéros de page (avec "…" au-delà de 7 pages) et "Suivant"
// - affichage simplifié sur mobile sous 600 px ("‹ Précédent   Page 2 / 5   Suivant ›")
import {
  calculerPagesVisibles,
  OPTIONS_PAR_PAGE,
} from '../utils/pagination.js';

function Pagination({
  pageCourante,
  totalPages,
  totalElements,
  debut,
  fin,
  parPage,
  onChangerPage,
  onChangerParPage,
}) {
  // Si la liste est vide ou tient toujours sur 1 seule page même avec 10 clients/page,
  // on masque complètement la zone de pagination
  const plusMinimumParPage = OPTIONS_PAR_PAGE[0];
  if (totalElements === 0 || totalElements <= plusMinimumParPage) {
    return null;
  }

  const pagesVisibles = calculerPagesVisibles(pageCourante, totalPages);
  const libelleClients = totalElements > 1 ? 'clients' : 'client';

  return (
    <div className="pagination">
      {/* Barre d'information et choix du nombre de clients par page */}
      <div className="pagination-meta">
        <p className="pagination-summary">
          Affichage {debut}–{fin} sur {totalElements} {libelleClients}
        </p>

        <div
          className="pagination-per-page"
          role="group"
          aria-label="Nombre de clients par page"
        >
          <span className="pagination-per-page-label">Afficher :</span>
          <div className="pagination-per-page-options">
            {OPTIONS_PAR_PAGE.map((option) => {
              const estActif = parPage === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={
                    estActif
                      ? 'pagination-size-btn pagination-size-btn-active'
                      : 'pagination-size-btn'
                  }
                  aria-pressed={estActif}
                  onClick={() => onChangerParPage(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contrôles de navigation masqués si tous les clients tiennent sur une seule page */}
      {totalPages > 1 && (
        <nav className="pagination-nav" aria-label="Pagination de la liste des clients">
          <button
            type="button"
            className="pagination-btn pagination-btn-nav"
            disabled={pageCourante <= 1}
            onClick={() => onChangerPage(pageCourante - 1)}
          >
            <span className="pagination-chevron-mobile" aria-hidden="true">
              ‹{' '}
            </span>
            Précédent
          </button>

          {/* Numéros de page affichés sur ordinateur */}
          <div className="pagination-pages">
            {pagesVisibles.map((element, index) => {
              if (element === '…') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="pagination-ellipsis"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const estPageCourante = element === pageCourante;
              return (
                <button
                  key={element}
                  type="button"
                  className={
                    estPageCourante
                      ? 'pagination-btn pagination-btn-page pagination-btn-active'
                      : 'pagination-btn pagination-btn-page'
                  }
                  aria-current={estPageCourante ? 'page' : undefined}
                  onClick={() => onChangerPage(element)}
                >
                  {element}
                </button>
              );
            })}
          </div>

          {/* Indicateur simplifié affiché uniquement sur mobile (sous 600 px) */}
          <span className="pagination-mobile-info" aria-current="page">
            Page {pageCourante} / {totalPages}
          </span>

          <button
            type="button"
            className="pagination-btn pagination-btn-nav"
            disabled={pageCourante >= totalPages}
            onClick={() => onChangerPage(pageCourante + 1)}
          >
            Suivant
            <span className="pagination-chevron-mobile" aria-hidden="true">
              {' '}
              ›
            </span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default Pagination;
