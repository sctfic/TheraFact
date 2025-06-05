// js/uiHelpers.js
import * as dom from './dom.js';
import * as state from './state.js';

export function populateTarifDropdowns() {
    // S'assure que les éléments DOM existent avant de les manipuler
    if (!dom.clientDefaultTarifSelect || !dom.seanceTarifSelect) {
        // console.warn("Éléments de sélection de tarif non trouvés dans le DOM pour populateTarifDropdowns.");
        return;
    }

    const tarifOptions = state.tarifs.map(t => {
        const dureeText = t.duree ? ` (${t.duree} min)` : '';
        return `<option value="${t.id}">${t.libelle}${dureeText} - ${parseFloat(t.montant).toFixed(2)}€</option>`;
    }).join('');

    dom.clientDefaultTarifSelect.innerHTML = '<option value="">Aucun</option>' + tarifOptions;
    dom.seanceTarifSelect.innerHTML = '<option value="">Sélectionner un tarif</option>' + tarifOptions;
}