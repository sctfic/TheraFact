// js/modal.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast } from './utils.js';

export function openDeleteModal(id, type, itemName) {
    state.setItemToDelete(id, type);
    if (dom.deleteModalTitle) dom.deleteModalTitle.textContent = `Confirmation de suppression`;
    if (dom.deleteModalMessage) dom.deleteModalMessage.textContent = `Êtes-vous sûr de vouloir supprimer "${itemName}" ? Cette action est irréversible.`;
    if (dom.deleteConfirmModal) dom.deleteConfirmModal.style.display = 'block';
}

export function closeDeleteModal() {
    if (dom.deleteConfirmModal) dom.deleteConfirmModal.style.display = 'none';
    state.clearItemToDelete();
}

async function handleDeleteConfirm() {
    if (state.itemToDelete.id && state.itemToDelete.type) {
        try {
            let successMessage = '';
            const itemType = state.itemToDelete.type;
            const itemId = state.itemToDelete.id;

            if (itemType === 'seance') {
                const seance = state.seances.find(s => s.id_seance === itemId);
                if (seance && seance.invoice_number) {
                   showToast("Impossible de supprimer une séance facturée.", "error");
                   closeDeleteModal();
                   return;
                }
            }
            
            await api.deleteItem(itemId, itemType);

            if (itemType === 'client') successMessage = 'Client supprimé avec succès.';
            else if (itemType === 'tarif') successMessage = 'Tarif supprimé avec succès.';
            else if (itemType === 'seance') successMessage = 'Séance supprimée avec succès.';
            
            showToast(successMessage, 'success');

            // Rafraîchir les données et les vues concernées
            if (itemType === 'client') { 
                await api.fetchClients(); // Rafraîchit clients, renderTable, dropdowns, dashboard
                await api.fetchSeances(); // Rafraîchit séances, renderTable, dashboard
            } else if (itemType === 'tarif') { 
                await api.fetchTarifs(); // Rafraîchit tarifs, renderTable, dropdowns, dashboard
                await api.fetchClients(); // Pour màj des tarifs par défaut affichés
                await api.fetchSeances(); // Pour màj des types de séances affichés
            } else if (itemType === 'seance') { 
                await api.fetchSeances(); // Rafraîchit séances, renderTable, dashboard
            }

        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
            console.error('Erreur de suppression :', error);
        }
    }
    closeDeleteModal();
}

export function initializeModal() {
    if (dom.confirmDeleteBtn) dom.confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);
    if (dom.cancelDeleteBtn) dom.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    
    window.addEventListener('click', (event) => { 
        if (event.target === dom.deleteConfirmModal) {
            closeDeleteModal(); 
        }
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === "Escape" && dom.deleteConfirmModal && dom.deleteConfirmModal.style.display === 'block') {
            closeDeleteModal();
        }
    });
}