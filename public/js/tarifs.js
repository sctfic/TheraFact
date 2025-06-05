
// js/tarifs.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast } from './utils.js';
import { openDeleteModal } from './modal.js';

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
        dom.tarifDureeInput.value = ''; 
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
        duree: dom.tarifDureeInput.value ? parseInt(dom.tarifDureeInput.value) : null
    };
    if (state.editingTarifId) {
        tarifData.id = state.editingTarifId;
    }

    if (isNaN(tarifData.montant) || tarifData.montant < 0) {
        showToast("Le montant du tarif est invalide.", "error"); return;
    }
    if (tarifData.duree !== null && (isNaN(tarifData.duree) || tarifData.duree < 0)) {
        showToast("La durée du tarif est invalide.", "error"); return;
    }

    try {
        await api.saveTarif(tarifData);
        await api.fetchTarifs(); // Rafraîchit tarifs, renderTable, dropdowns, dashboard
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
    state.tarifs.forEach(tarif => {
        const row = dom.tarifsTableBody.insertRow();
        row.insertCell().textContent = tarif.libelle;
        row.insertCell().textContent = tarif.duree ? `${tarif.duree} min` : '-';
        row.insertCell().textContent = parseFloat(tarif.montant).toFixed(2) + ' €';
        
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier'; 
        editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        editBtn.style.marginRight = '5px'; 
        editBtn.onclick = () => openTarifForm(tarif.id);
        actionsCell.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer'; 
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.onclick = () => openDeleteModal(tarif.id, 'tarif', tarif.libelle);
        actionsCell.appendChild(deleteBtn);
    });
}

export function initializeTarifManagement() {
    if (dom.btnAddTarif) dom.btnAddTarif.addEventListener('click', () => openTarifForm());
    if (dom.cancelTarifFormBtn) dom.cancelTarifFormBtn.addEventListener('click', closeTarifForm);
    if (dom.tarifForm) dom.tarifForm.addEventListener('submit', handleTarifFormSubmit);
}