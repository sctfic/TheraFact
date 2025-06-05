// js/tarifs.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast } from './utils.js';
import { openDeleteModal } from './modal.js';
import { populateTarifDropdowns } from './uiHelpers.js';

function openTarifForm(tarifId = null) {
    state.setEditingTarifId(tarifId);
    if (tarifId) {
        const tarif = state.tarifs.find(t => t.id === tarifId);
        if (tarif) {
            // dom.tarifFormTitle.textContent = 'Modifier le tarif';
            dom.tarifIdInput.value = tarif.id;
            dom.tarifLibelleInput.value = tarif.libelle;
            dom.tarifMontantInput.value = parseFloat(tarif.montant).toFixed(2);
            dom.tarifDureeInput.value = tarif.duree || '';
        }
    } else {
        // dom.tarifFormTitle.textContent = 'Ajouter un nouveau tarif';
        dom.tarifForm.reset();
        dom.tarifIdInput.value = '';
    }
    dom.tarifFormContainer.classList.remove('hidden');
}

function closeTarifForm() {
    dom.tarifFormContainer.classList.add('hidden');
    dom.tarifForm.reset();
    state.setEditingTarifId(null);
}

async function handleTarifFormSubmit(event) {
    event.preventDefault();
    const tarifData = {
        libelle: dom.tarifLibelleInput.value,
        montant: parseFloat(dom.tarifMontantInput.value),
        duree: dom.tarifDureeInput.value ? parseInt(dom.tarifDureeInput.value, 10) : null
    };

    if (isNaN(tarifData.montant)) {
        showToast('Le montant doit être un nombre valide.', 'error');
        return;
    }
    if (tarifData.duree !== null && (isNaN(tarifData.duree) || tarifData.duree < 0)) {
        showToast('La durée doit être un nombre positif ou laissée vide.', 'error');
        return;
    }


    if (state.editingTarifId) {
        tarifData.id = state.editingTarifId;
    }

    try {
        await api.saveTarif(tarifData);
        await api.fetchTarifs(); // Rafraîchit tarifs, renderTable, dropdowns, dashboard
        // Rafraîchir les clients et les séances si un tarif a été modifié, car il peut être utilisé
        await api.fetchClients(); 
        await api.fetchSeances();
        closeTarifForm();
        showToast('Tarif enregistré avec succès.', 'success');
    } catch (error) {
        showToast(`Erreur sauvegarde tarif: ${error.message}`, 'error');
    }
}

export function renderTarifsTable() {
    if (!dom.tarifsTableBody) return;
    dom.tarifsTableBody.innerHTML = '';
    
    if (state.tarifs.length === 0) {
        dom.tarifsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucun tarif défini.</td></tr>';
        return;
    }

    const sortedTarifs = [...state.tarifs].sort((a,b) => a.libelle.localeCompare(b.libelle));

    sortedTarifs.forEach(tarif => {
        const row = dom.tarifsTableBody.insertRow();
        row.insertCell().textContent = tarif.libelle;
        row.insertCell().textContent = tarif.duree ? `${tarif.duree} min` : '-';
        row.insertCell().textContent = parseFloat(tarif.montant).toFixed(2) + ' €';
        
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        
        // MODIFIÉ: Le bouton Modifier est supprimé, le double-clic est ajouté ci-dessous
        // const editBtn = document.createElement('button');
        // editBtn.textContent = 'Modifier';
        // editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        // editBtn.style.marginRight = '5px';
        // editBtn.onclick = () => openTarifForm(tarif.id);
        // actionsCell.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&#x1F5D1;'; // MODIFIÉ: Icône poubelle
        deleteBtn.title = 'Supprimer';    // Ajout du title pour l'accessibilité
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'btn-icon-delete');
        deleteBtn.onclick = () => openDeleteModal(tarif.id, 'tarif', tarif.libelle);
        actionsCell.appendChild(deleteBtn);

        // AJOUT: Double-clic pour éditer la ligne
        row.addEventListener('dblclick', () => openTarifForm(tarif.id));
    });
}

export function initializeTarifManagement() {
    if (dom.btnAddTarif) dom.btnAddTarif.addEventListener('click', () => openTarifForm());
    if (dom.cancelTarifFormBtn) dom.cancelTarifFormBtn.addEventListener('click', closeTarifForm);
    if (dom.tarifForm) dom.tarifForm.addEventListener('submit', handleTarifFormSubmit);
}