// js/clients.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast } from './utils.js';
import { openDeleteModal } from './modal.js';
import { switchView } from './navigation.js';
import { populateTarifDropdowns } from './uiHelpers.js'; 
import { 
    updateSeanceMontant as updateNewSeanceMontant, 
    toggleSeancePaymentFields as toggleNewSeancePaymentFields 
} from './seances.js';

function openClientForm(clientId = null) {
    state.setEditingClientId(clientId);
    populateTarifDropdowns(); 

    if (clientId) {
        const client = state.clients.find(c => c.id === clientId);
        if (client) {
            // dom.clientFormTitle.textContent = 'Modifier le client';
            dom.clientIdInput.value = client.id;
            dom.clientNomInput.value = client.nom;
            dom.clientPrenomInput.value = client.prenom;
            dom.clientTelephoneInput.value = client.telephone || '';
            dom.clientEmailInput.value = client.email || '';
            dom.clientAdresseInput.value = client.adresse || '';
            dom.clientVilleInput.value = client.ville || '';
            dom.clientNotesInput.value = client.notes || '';
            dom.clientDefaultTarifSelect.value = client.defaultTarifId || "";
        }
    } else {
        // dom.clientFormTitle.textContent = 'Ajouter un nouveau client';
        dom.clientForm.reset(); 
        dom.clientIdInput.value = '';
        dom.clientDefaultTarifSelect.value = ""; 
    }
    dom.clientFormContainer.classList.remove('hidden');
}

function closeClientForm() {
    dom.clientFormContainer.classList.add('hidden');
    dom.clientForm.reset();
    state.setEditingClientId(null);
}

async function handleClientFormSubmit(event) {
    event.preventDefault();
    const clientData = {
        nom: dom.clientNomInput.value,
        prenom: dom.clientPrenomInput.value,
        telephone: dom.clientTelephoneInput.value,
        email: dom.clientEmailInput.value,
        adresse: dom.clientAdresseInput.value,
        ville: dom.clientVilleInput.value,
        notes: dom.clientNotesInput.value,
        defaultTarifId: dom.clientDefaultTarifSelect.value || null,
    };

    if (state.editingClientId) {
        clientData.id = state.editingClientId;
        const originalClient = state.clients.find(c => c.id === state.editingClientId);
        clientData.statut = originalClient.statut;
        clientData.dateCreation = originalClient.dateCreation;
    } else {
        clientData.statut = 'actif';
        clientData.dateCreation = new Date().toISOString();
    }

    try {
        await api.saveClient(clientData);
        await api.fetchClients(); 
        closeClientForm();
        showToast('Client enregistré avec succès.', 'success');
    } catch (error) {
        showToast(`Erreur sauvegarde client: ${error.message}`, 'error');
    }
}

async function toggleClientStatus(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
        const newStatus = client.statut === 'actif' ? 'inactif' : 'actif';
        const updatedClient = { ...client, statut: newStatus };
        try {
            await api.saveClient(updatedClient); 
            const clientIndex = state.clients.findIndex(c => c.id === clientId);
            if (clientIndex > -1) {
                state.clients[clientIndex].statut = newStatus;
            }
            renderClientsTable(); 
            showToast('Statut client mis à jour.', 'success');
        } catch (error) {
            showToast(`Erreur MAJ statut client: ${error.message}`, 'error');
        }
    }
}

function handleClientRowDblClick(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    switchView('viewSeances');
    state.setEditingSeanceId(null); 

    // dom.seanceFormTitle.textContent = `Ajouter une séance pour ${client.prenom} ${client.nom}`;
    dom.seanceForm.reset();
    dom.seanceIdInput.value = '';

    dom.seanceClientNameInput.value = `${client.prenom} ${client.nom}`;
    dom.seanceClientIdInput.value = client.id;
    if (dom.clientAutocompleteResults) {
        dom.clientAutocompleteResults.innerHTML = '';
        dom.clientAutocompleteResults.classList.add('hidden');
    }

    populateTarifDropdowns(); 

    if (client.defaultTarifId && state.tarifs.find(t => t.id === client.defaultTarifId)) {
        dom.seanceTarifSelect.value = client.defaultTarifId;
        updateNewSeanceMontant(); 
    } else {
        dom.seanceTarifSelect.value = '';
        dom.seanceMontantInput.value = '';
    }
    
    const now = new Date();
    let currentMinutes = now.getMinutes();
    let roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
    
    now.setSeconds(0);
    now.setMilliseconds(0);

    if (roundedMinutes >= 60) {
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
    } else {
        now.setMinutes(roundedMinutes);
    }
    
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const finalMinutes = now.getMinutes().toString().padStart(2, '0');
    
    if (dom.seanceDateElement) dom.seanceDateElement.value = `${year}-${month}-${day}T${hours}:${finalMinutes}`;
    
    if(dom.seanceStatutSelect) dom.seanceStatutSelect.value = 'PLANIFIEE';
    toggleNewSeancePaymentFields('PLANIFIEE'); 
    dom.seanceFormContainer.classList.remove('hidden');
    dom.seanceClientNameInput.focus(); 
}


export function renderClientsTable() {
    if (!dom.clientsTableBody) return;
    dom.clientsTableBody.innerHTML = '';
    const searchTerm = dom.searchClientInput ? dom.searchClientInput.value.toLowerCase() : "";
    const statutFilter = dom.filterClientStatut ? dom.filterClientStatut.value : "";
    
    let localFilteredClients = state.clients.filter(client =>
        (client.nom.toLowerCase().includes(searchTerm) || client.prenom.toLowerCase().includes(searchTerm)) &&
        (statutFilter === "" || client.statut === statutFilter)
    );

    localFilteredClients.sort((a, b) => {
        if (a.statut === 'actif' && b.statut !== 'actif') return -1;
        if (a.statut !== 'actif' && b.statut === 'actif') return 1;
        const prenomA = a.prenom ? a.prenom.toLowerCase() : '';
        const prenomB = b.prenom ? b.prenom.toLowerCase() : '';
        if (prenomA < prenomB) return -1;
        if (prenomA > prenomB) return 1;
        const nomA = a.nom ? a.nom.toLowerCase() : '';
        const nomB = b.nom ? b.nom.toLowerCase() : '';
        return nomA.localeCompare(nomB);
    });

    if (localFilteredClients.length === 0) {
        dom.clientsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Aucun client trouvé.</td></tr>';
        return;
    }

    localFilteredClients.forEach(client => {
        const row = dom.clientsTableBody.insertRow();
        row.insertCell().textContent = client.nom;
        row.insertCell().textContent = client.prenom;
        row.insertCell().textContent = client.email || '-';
        row.insertCell().textContent = client.adresse || '-';
        row.insertCell().textContent = client.ville || '-';
        const phoneCell = row.insertCell();
        if (client.telephone) {
            const phoneLink = document.createElement('a');
            phoneLink.href = `tel:${client.telephone.replace(/\s/g, '')}`; // Remove spaces for tel URI
            phoneLink.textContent = client.telephone;
            phoneLink.style.textDecoration = 'none'; // Optional: remove underline
            phoneLink.style.color = 'inherit'; // Optional: keep original text color
            phoneCell.appendChild(phoneLink);
        } else {
            phoneCell.textContent = '-';
        }
        
        const statusCell = row.insertCell();
        statusCell.classList.add('status-cell');
        const statusCheckbox = document.createElement('input');
        statusCheckbox.type = 'checkbox';
        statusCheckbox.checked = client.statut === 'actif';
        statusCheckbox.title = client.statut === 'actif' ? 'Client actif (désactiver)' : 'Client inactif (activer)';
        statusCheckbox.onchange = () => toggleClientStatus(client.id);
        statusCell.appendChild(statusCheckbox);
        
        const defaultTarif = state.tarifs.find(t => t.id === client.defaultTarifId);
        let tarifDisplayText = '-';
        if (defaultTarif) {
            const dureeText = defaultTarif.duree ? ` (${defaultTarif.duree} min)` : '';
            tarifDisplayText = `${defaultTarif.libelle}${dureeText} - ${parseFloat(defaultTarif.montant).toFixed(2)}€`;
        }
        row.insertCell().textContent = tarifDisplayText;
        row.insertCell().textContent = client.dateCreation ? new Date(client.dateCreation).toLocaleDateString('fr-FR') : '-';
        
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier'; 
        editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        editBtn.style.marginRight = '5px'; 
        editBtn.onclick = () => openClientForm(client.id);
        actionsCell.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&#x1F5D1;'; // MODIFIÉ: Icône poubelle
        deleteBtn.title = 'Supprimer';    // Ajout du title pour l'accessibilité
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'btn-icon-delete');
        deleteBtn.onclick = () => openDeleteModal(client.id, 'client', `${client.prenom} ${client.nom}`);
        actionsCell.appendChild(deleteBtn);

        row.addEventListener('dblclick', () => handleClientRowDblClick(client.id));
    });
}

export function initializeClientManagement() {
    if (dom.btnAddClient) dom.btnAddClient.addEventListener('click', () => openClientForm());
    if (dom.cancelClientFormBtn) dom.cancelClientFormBtn.addEventListener('click', closeClientForm);
    if (dom.clientForm) dom.clientForm.addEventListener('submit', handleClientFormSubmit);
    if (dom.searchClientInput) dom.searchClientInput.addEventListener('input', renderClientsTable);
    if (dom.filterClientStatut) dom.filterClientStatut.addEventListener('change', renderClientsTable);
}