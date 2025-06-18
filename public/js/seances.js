// public/js/seances.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast, generateUUID, getAppBaseUrl, showDemoAlert } from './utils.js';
import { openDeleteModal } from './modal.js';
import { populateTarifDropdowns } from './uiHelpers.js';

const APP_BASE_URL = getAppBaseUrl();

// Helper function pour formater une date en YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Nouvelle fonction pour appliquer les filtres de date par défaut
export function applyDefaultSeanceDateFilters() {
    if (dom.filterSeanceDateStart && dom.filterSeanceDateEnd) {
        const today = new Date();

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        dom.filterSeanceDateStart.value = formatDateToYYYYMMDD(yesterday);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        dom.filterSeanceDateEnd.value = formatDateToYYYYMMDD(tomorrow);
    }
}

function renderAvailability(busySlots) {
    const container = dom.availabilityInfoContainer;
    const list = dom.availabilityList;

    if (!container || !list) return;

    list.innerHTML = ''; // Vider la liste précédente

    if (!busySlots || busySlots.length === 0) {
        list.innerHTML = '<li>Aucun événement trouvé dans les 90 prochains jours.</li>';
        container.classList.remove('hidden');
        return;
    }

    // Formatter et afficher chaque créneau occupé
    busySlots.forEach(slot => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

        const li = document.createElement('li');
        li.textContent = `Occupé du ${start.toLocaleDateString('fr-FR', options)} au ${end.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;
        list.appendChild(li);
    });

    container.classList.remove('hidden');
}


function resetAndOpenSeanceForm(seanceId = null) {
    state.setEditingSeanceId(seanceId);
    dom.seanceForm.reset();
    dom.seanceIdInput.value = '';
    dom.seanceClientNameInput.value = '';
    dom.seanceClientIdInput.value = '';
    if (dom.clientAutocompleteResults) {
        dom.clientAutocompleteResults.innerHTML = '';
        dom.clientAutocompleteResults.classList.add('hidden');
    }

    populateTarifDropdowns(); 
    // Cacher les anciennes disponibilités et afficher "chargement"
    if (dom.availabilityInfoContainer) dom.availabilityInfoContainer.classList.add('hidden');
    if (dom.availabilityList) dom.availabilityList.innerHTML = '<li>Chargement des disponibilités...</li>';
    
    if (!state.appSettings.googleOAuth.isConnected) {
        if (dom.availabilityList) dom.availabilityList.innerHTML = '<li>La connexion à Google est requise pour voir les disponibilités.</li>';
        if (dom.availabilityInfoContainer) dom.availabilityInfoContainer.classList.remove('hidden');
    } else {
        // Appeler l'API pour récupérer les disponibilités et les afficher
        api.fetchCalendarAvailability().then(busySlots => {
            renderAvailability(busySlots);
        });
    }

    if (seanceId) {
        const seance = state.seances.find(s => s.id_seance === seanceId);
        if (seance) {
            dom.seanceIdInput.value = seance.id_seance;
            const client = state.clients.find(c => c.id === seance.id_client);
            dom.seanceClientNameInput.value = client ? `${client.prenom} ${client.nom}` : '';
            dom.seanceClientIdInput.value = seance.id_client;

            if (dom.seanceDateElement) {
                const dateValue = new Date(seance.date_heure_seance);
                if (!isNaN(dateValue.getTime())) {
                    let currentMinutes = dateValue.getMinutes();
                    let roundedMinutes = Math.round(currentMinutes / 15) * 15;
                    dateValue.setSeconds(0);
                    dateValue.setMilliseconds(0);
                    if (roundedMinutes >= 60) {
                        dateValue.setHours(dateValue.getHours() + 1);
                        dateValue.setMinutes(0);
                    } else {
                        dateValue.setMinutes(roundedMinutes);
                    }
                    const year = dateValue.getFullYear();
                    const month = (dateValue.getMonth() + 1).toString().padStart(2, '0');
                    const day = dateValue.getDate().toString().padStart(2, '0');
                    const hours = dateValue.getHours().toString().padStart(2, '0');
                    const finalMinutes = dateValue.getMinutes().toString().padStart(2, '0');
                    dom.seanceDateElement.value = `${year}-${month}-${day}T${hours}:${finalMinutes}`;
                } else {
                    dom.seanceDateElement.value = seance.date_heure_seance; 
                }
            }
            
            dom.seanceTarifSelect.value = seance.id_tarif;
            dom.seanceMontantInput.value = parseFloat(seance.montant_facture).toFixed(2);
            dom.seanceStatutSelect.value = seance.statut_seance;
            toggleSeancePaymentFields(seance.statut_seance);
            if (seance.statut_seance === 'PAYEE') {
                dom.seanceModePaiementSelect.value = seance.mode_paiement || '';
                dom.seanceDatePaiementInput.value = seance.date_paiement ? (seance.date_paiement.includes('T') ? seance.date_paiement.split('T')[0] : seance.date_paiement) : '';
            }
        }
    } else {
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
        if(dom.seanceDateElement) dom.seanceDateElement.value = `${year}-${month}-${day}T${hours}:${finalMinutes}`;
        
        dom.seanceTarifSelect.value = '';
        dom.seanceMontantInput.value = '';
        dom.seanceStatutSelect.value = 'PLANIFIEE'; 
        toggleSeancePaymentFields('PLANIFIEE');
    }
    dom.seanceFormContainer.classList.remove('hidden');
}

function closeSeanceForm() {
    dom.seanceFormContainer.classList.add('hidden');
    dom.seanceForm.reset();
    state.setEditingSeanceId(null);
    if (dom.availabilityInfoContainer) {
        dom.availabilityInfoContainer.classList.add('hidden');
    }
    if (dom.clientAutocompleteResults) {
        dom.clientAutocompleteResults.innerHTML = '';
        dom.clientAutocompleteResults.classList.add('hidden');
    }
}

export function updateSeanceMontant() { 
    const selectedTarifId = dom.seanceTarifSelect.value;
    const tarif = state.tarifs.find(t => t.id === selectedTarifId);
    if (tarif) dom.seanceMontantInput.value = parseFloat(tarif.montant).toFixed(2);
    else dom.seanceMontantInput.value = '';
}

export function toggleSeancePaymentFields(statut) { 
    if (!dom.seanceModePaiementGroup || !dom.seanceDatePaiementGroup) return;
    if (statut === 'PAYEE') {
        dom.seanceModePaiementGroup.classList.remove('hidden');
        dom.seanceDatePaiementGroup.classList.remove('hidden');
        if (!dom.seanceDatePaiementInput.value) {
             dom.seanceDatePaiementInput.valueAsDate = new Date();
        }
    } else {
        dom.seanceModePaiementGroup.classList.add('hidden');
        dom.seanceDatePaiementGroup.classList.add('hidden');
        if(dom.seanceModePaiementSelect) dom.seanceModePaiementSelect.value = '';
        if(dom.seanceDatePaiementInput) dom.seanceDatePaiementInput.value = '';
    }
}

async function handleSeanceFormSubmit(event) {
    event.preventDefault();
    let idClient = dom.seanceClientIdInput.value;
    const clientNameFromInput = dom.seanceClientNameInput.value.trim();
    if (!idClient && clientNameFromInput) { 
        const foundClient = state.clients.find(c => `${c.prenom} ${c.nom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase() || `${c.nom} ${c.prenom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase());
        if (foundClient) { idClient = foundClient.id; dom.seanceClientIdInput.value = idClient; }
    }
    if (!idClient || !state.clients.find(c => c.id === idClient)) { showToast("Client invalide.", "error"); return; }
    
    const idTarif = dom.seanceTarifSelect.value;
    if (!idTarif || !state.tarifs.find(t => t.id === idTarif)) { 
        showToast("Tarif invalide.", "error"); 
        return; 
    }

    const selectedTarif = state.tarifs.find(t => t.id === idTarif);
    const dureeSeance = selectedTarif ? selectedTarif.duree : null;

    const montant = parseFloat(dom.seanceMontantInput.value);
    if (isNaN(montant)) { 
        showToast("Montant invalide.", "error"); 
        return; 
    }

    const seanceData = {
        id_seance: dom.seanceIdInput.value || generateUUID(),
        id_client: idClient,
        date_heure_seance: dom.seanceDateElement.value,
        id_tarif: idTarif,
        duree_seance: dureeSeance,
        montant_facture: montant,
        statut_seance: dom.seanceStatutSelect.value,
        mode_paiement: dom.seanceStatutSelect.value === 'PAYEE' ? (dom.seanceModePaiementSelect.value || null) : null,
        date_paiement: dom.seanceStatutSelect.value === 'PAYEE' && dom.seanceDatePaiementInput.value ? dom.seanceDatePaiementInput.value : null,
    };

    if (state.editingSeanceId) { 
        const existingSeance = state.seances.find(s => s.id_seance === state.editingSeanceId);
        seanceData.invoice_number = existingSeance?.invoice_number || null;
        seanceData.devis_number = existingSeance?.devis_number || null;
        seanceData.googleCalendarEventId = existingSeance?.googleCalendarEventId || null; 
    }

    try {
        const result = await api.saveSeance(seanceData);
        state.updateSeanceInState(result.updatedSeance || seanceData); 
        renderSeancesTable(); 
        closeSeanceForm();
        showToast(result.message || 'Séance enregistrée.', 'success'); 
    } catch (error) {
        showToast(`Erreur sauvegarde séance: ${error.message}`, 'error');
    }
}

export function renderSeancesTable() {
    if (!dom.seancesTableBody) return;
    dom.seancesTableBody.innerHTML = '';
    const clientSearchTerm = dom.searchSeanceClientInput ? dom.searchSeanceClientInput.value.toLowerCase() : "";
    const statutFilter = dom.filterSeanceStatut ? dom.filterSeanceStatut.value : "";
    const dateStartFilter = dom.filterSeanceDateStart ? dom.filterSeanceDateStart.value : "";
    const dateEndFilter = dom.filterSeanceDateEnd ? dom.filterSeanceDateEnd.value : "";

    const filteredAndSortedSeances = state.seances.filter(seance => {
        const client = state.clients.find(c => c.id === seance.id_client);
        const clientName = client ? `${client.prenom} ${client.nom}`.toLowerCase() : '';
        const matchesClient = !clientSearchTerm || clientName.includes(clientSearchTerm);
        const matchesStatut = !statutFilter || seance.statut_seance === statutFilter;
        let matchesDate = true;
        if (seance.date_heure_seance) {
            const seanceDateOnly = seance.date_heure_seance.split('T')[0];
            if (dateStartFilter && seanceDateOnly < dateStartFilter) matchesDate = false;
            if (dateEndFilter && seanceDateOnly > dateEndFilter) matchesDate = false;
        } else { if(dateStartFilter || dateEndFilter) matchesDate = false; }
        return matchesClient && matchesStatut && matchesDate;
    }).sort((a, b) => new Date(b.date_heure_seance) - new Date(a.date_heure_seance)); 

    if (filteredAndSortedSeances.length === 0) {
        dom.seancesTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Aucune séance trouvée.</td></tr>';
        return;
    }

    filteredAndSortedSeances.forEach(seance => {
        const row = dom.seancesTableBody.insertRow();
        row.dataset.seanceId = seance.id_seance;
        const dateCell = row.insertCell();
        if (seance.date_heure_seance) {
            const d = new Date(seance.date_heure_seance);
            const datePart = d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
            const timePart = d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            dateCell.innerHTML = `${datePart}<br>${timePart}`;
        } else {
            dateCell.textContent = '-';
        }
        const client = state.clients.find(c => c.id === seance.id_client);
        row.insertCell().textContent = client ? `${client.prenom} ${client.nom}` : 'Client inconnu';
        const tarif = state.tarifs.find(t => t.id === seance.id_tarif);
        row.insertCell().textContent = tarif ? tarif.libelle : 'Tarif inconnu';
        row.insertCell().textContent = parseFloat(seance.montant_facture).toFixed(2) + ' €';
        
        const statutCell = row.insertCell();
        statutCell.dataset.column = "statut_seance";
        let statutText = seance.statut_seance;
        if(seance.statut_seance === 'APAYER') statutText = 'À Payer';
        else if(seance.statut_seance === 'PAYEE') statutText = 'Payée';
        else if(seance.statut_seance === 'ANNULEE') statutText = 'Annulée';
        else if(seance.statut_seance === 'PLANIFIEE') statutText = 'Planifiée';
        statutCell.textContent = statutText;
        
        const modePaiementCell = row.insertCell();
        modePaiementCell.dataset.column = "mode_paiement";
        modePaiementCell.textContent = seance.mode_paiement || '-';
        
        const datePaiementCell = row.insertCell();
        datePaiementCell.dataset.column = "date_paiement";
        datePaiementCell.textContent = seance.date_paiement ? new Date(seance.date_paiement).toLocaleDateString('fr-FR') : '-';
        
        const invoiceCell = row.insertCell();
        invoiceCell.classList.add('invoice-cell');
        invoiceCell.innerHTML = ''; 

        // MODIFIÉ : Logique de décision basée sur le début de la séance
        const now = new Date();
        const seanceStart = new Date(seance.date_heure_seance);
        const showDevisLogic = now < seanceStart;

        const createDocumentLink = (docNumber) => {
            const link = document.createElement('a');
            link.href = `/api/documents/view/${docNumber}.pdf`;
            link.textContent = docNumber;
            link.target = '_blank';
            link.style.marginRight = '5px';
            return link;
        };

        if (showDevisLogic) {
            if (seance.devis_number) {
                invoiceCell.appendChild(createDocumentLink(seance.devis_number));
                const emailDevisBtn = document.createElement('button');
                emailDevisBtn.innerHTML = '<img class="brightness" src="pictures/sendEmail.png" alt="Envoyer devis" style="height: 1.3em; vertical-align: middle;">';
                emailDevisBtn.classList.add('btn', 'btn-primary', 'btn-sm');
                emailDevisBtn.title = 'Envoyer le devis par email';
                emailDevisBtn.style.padding = '0.1rem 0.2rem';
                emailDevisBtn.onclick = (e) => { e.stopPropagation(); handleSendDevisByEmail(seance.id_seance, seance.devis_number, client ? client.email : null);};
                invoiceCell.appendChild(emailDevisBtn);
            } else if (!seance.invoice_number) { 
                const btnGenererDevis = document.createElement('button');
                btnGenererDevis.textContent = 'Devis';
                btnGenererDevis.classList.add('btn', 'btn-primary', 'btn-sm');
                btnGenererDevis.onclick = (e) => { e.stopPropagation(); handleGenerateDevis(seance.id_seance); };
                invoiceCell.appendChild(btnGenererDevis);
            } else { 
                invoiceCell.appendChild(createDocumentLink(seance.invoice_number));
            }
        } else { // La séance a commencé ou est passée
            if (seance.invoice_number) {
                invoiceCell.appendChild(createDocumentLink(seance.invoice_number));
                const emailBtn = document.createElement('button');
                emailBtn.innerHTML = '<img class="brightness" src="pictures/sendEmail.png" alt="Envoyer facture" style="height: 1.3em; vertical-align: middle;">';
                emailBtn.classList.add('btn', 'btn-success', 'btn-sm');
                emailBtn.title = 'Envoyer la facture par email';
                emailBtn.style.padding = '0.1rem 0.2rem';
                emailBtn.onclick = (e) => { e.stopPropagation(); handleSendInvoiceByEmail(seance.id_seance, seance.invoice_number, client ? client.email : null);};
                invoiceCell.appendChild(emailBtn);
            } else { 
                if (seance.devis_number) {
                    const devisInfo = document.createElement('span');
                    devisInfo.textContent = `(Devis: ${seance.devis_number}) `;
                    devisInfo.style.fontSize = '0.8em';
                    devisInfo.style.marginRight = '3px';
                    invoiceCell.appendChild(devisInfo);
                }
                const btnFacturer = document.createElement('button');
                btnFacturer.textContent = 'Facturer';
                btnFacturer.classList.add('btn', 'btn-success', 'btn-sm');
                btnFacturer.onclick = (e) => { e.stopPropagation(); handleGenerateInvoice(seance.id_seance); };
                invoiceCell.appendChild(btnFacturer);
            }
        }
        
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        if (!seance.invoice_number) { 
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
            editBtn.style.marginRight = '5px';
            editBtn.onclick = (e) => { e.stopPropagation(); resetAndOpenSeanceForm(seance.id_seance); };
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&#x1F5D1;';
            deleteBtn.title = 'Supprimer';
            deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'btn-icon-delete');
            deleteBtn.onclick = (e) => { e.stopPropagation(); openDeleteModal(seance.id_seance, 'seance', `Séance du ${new Date(seance.date_heure_seance).toLocaleDateString()}`); };
            actionsCell.appendChild(deleteBtn);
        } else { 
            actionsCell.textContent = '-'; 
        }
        row.addEventListener('dblclick', (event) => handleSeanceRowDblClick(event, seance.id_seance));
    });
}

async function handleGenerateInvoice(seanceId) {
    if (state.currentlyEditingRow && state.currentlyEditingRow.dataset.seanceId === seanceId) {
        const currentSeance = state.seances.find(s => s.id_seance === seanceId);
        if (currentSeance) await saveRowChanges(state.currentlyEditingRow, currentSeance);
    }
    showToast('Génération facture...', 'info');
    try {
        const result = await api.generateInvoiceForSeanceApi(seanceId);
        showToast(`Facture ${result.invoiceNumber} générée.`, 'success');
        
        const updatedSeance = {
            ...state.seances.find(s => s.id_seance === seanceId),
            invoice_number: result.invoiceNumber,
            devis_number: null,
            statut_seance: result.newSeanceStatus || 'APAYER'
        };
        state.updateSeanceInState(updatedSeance);
        
        renderSeancesTable(); 
    } catch (error) { showToast(`Erreur: ${error.message}`, 'error'); }
}

async function handleGenerateDevis(seanceId) {
    if (state.currentlyEditingRow && state.currentlyEditingRow.dataset.seanceId === seanceId) {
        const seance = state.seances.find(s => s.id_seance === seanceId);
       if (seance) await saveRowChanges(state.currentlyEditingRow, seance);
    }
    showToast('Génération devis...', 'info');
    try {
        const result = await api.generateDevisForSeanceApi(seanceId);
        showToast(`Devis ${result.devisNumber} généré.`, 'success');
        
        const updatedSeance = {
            ...state.seances.find(s => s.id_seance === seanceId),
            devis_number: result.devisNumber
        };
        state.updateSeanceInState(updatedSeance);
        
        renderSeancesTable(); 
    } catch (error) { showToast(`Erreur génération devis: ${error.message}`, 'error'); }
}

async function handleSendInvoiceByEmail(seanceId, invoiceNumber, clientEmail) {
    if (!state.appSettings.googleOAuth.isConnected) {
        showDemoAlert();
        return;
    }
    if (state.currentlyEditingRow && state.currentlyEditingRow.dataset.seanceId === seanceId) {
        const currentSeance = state.seances.find(s => s.id_seance === seanceId);
        if (currentSeance) await saveRowChanges(state.currentlyEditingRow, currentSeance);
    }
    
    let emailToSendTo = clientEmail;
    if (!emailToSendTo) {
        const clientForSeance = state.clients.find(c => c.id === state.seances.find(s => s.id_seance === seanceId)?.id_client);
        if (clientForSeance && clientForSeance.email) {
            emailToSendTo = clientForSeance.email;
        } else {
            showToast(`Email pour ${clientForSeance ? clientForSeance.prenom + ' ' + clientForSeance.nom : 'ce client'} non disponible. Veuillez l'ajouter à sa fiche.`, "error"); return;
        }
    }
    showToast(`Envoi email facture ${invoiceNumber}...`, 'info');
    try {
        const result = await api.sendInvoiceByEmailApi(invoiceNumber, emailToSendTo);
        showToast(result.message || `Facture ${invoiceNumber} envoyée à ${emailToSendTo}.`, 'success');
    } catch (error) { showToast(`Erreur envoi email: ${error.message}`, 'error'); }
}

async function handleSendDevisByEmail(seanceId, devisNumber, clientEmail) {
    if (!state.appSettings.googleOAuth.isConnected) {
        showDemoAlert();
        return;
    }
    if (state.currentlyEditingRow && state.currentlyEditingRow.dataset.seanceId === seanceId) {
        const seance = state.seances.find(s => s.id_seance === seanceId);
       if (seance) await saveRowChanges(state.currentlyEditingRow, seance);
    }
    
    let emailToSendTo = clientEmail;
    if (!emailToSendTo) {
        const clientForSeance = state.clients.find(c => c.id === state.seances.find(s => s.id_seance === seanceId)?.id_client);
        if (clientForSeance && clientForSeance.email) {
            emailToSendTo = clientForSeance.email;
        } else {
            showToast(`Email pour ${clientForSeance ? clientForSeance.prenom + ' ' + clientForSeance.nom : 'ce client'} non disponible. Veuillez l'ajouter à sa fiche.`, "error"); return;
        }
    }
    showToast(`Envoi email devis ${devisNumber}...`, 'info');
    try {
        const result = await api.sendDevisByEmailApi(devisNumber, emailToSendTo);
        showToast(result.message || `Devis ${devisNumber} envoyé à ${emailToSendTo}.`, 'success');
    } catch (error) { showToast(`Erreur envoi email devis: ${error.message}`, 'error'); }
}

async function handleSeanceRowDblClick(event, seanceId) {
    const row = event.currentTarget;
    if (!seanceId) return;
    const seance = state.seances.find(s => s.id_seance === seanceId);
    if (state.currentlyEditingRow && state.currentlyEditingRow !== row) {
        const oldSeanceId = state.currentlyEditingRow.dataset.seanceId;
        const oldSeance = state.seances.find(s => s.id_seance === oldSeanceId);
        if (oldSeance) await saveRowChanges(state.currentlyEditingRow, oldSeance);
        else revertRowToDisplayMode(state.currentlyEditingRow, null);
    }
    if (state.currentlyEditingRow === row) return; 
    
    state.setCurrentlyEditingRow(row);
    const statusCell = row.querySelector('td[data-column="statut_seance"]');
    if (statusCell) makeCellEditable(statusCell, seance, 'statut_seance');
    
    const statutSelectElement = statusCell ? statusCell.querySelector('select') : null;
    const currentStatusInEdit = statutSelectElement ? statutSelectElement.value : seance.statut_seance;
    togglePaymentFieldsInRow(row, seance, currentStatusInEdit);
}

function makeCellEditable(cell, seance, columnName) {
    if (!cell || (cell.querySelector('input') || cell.querySelector('select'))) return; 
    const originalValue = seance[columnName];
    cell.innerHTML = ''; 
    let inputElement;

    if (columnName === 'statut_seance') {
        inputElement = document.createElement('select');
        inputElement.classList.add('form-input-sm');
        const statuses = { "PLANIFIEE": "Planifiée", "APAYER": "À Payer", "PAYEE": "Payée", "ANNULEE": "Annulée" };
        for (const key in statuses) {
            const option = document.createElement('option');
            option.value = key; option.textContent = statuses[key];
            if (key === originalValue) option.selected = true;
            inputElement.appendChild(option);
        }
        inputElement.addEventListener('change', () => togglePaymentFieldsInRow(cell.parentElement, seance, inputElement.value));
    } else if (columnName === 'mode_paiement') {
        inputElement = document.createElement('select');
        inputElement.classList.add('form-input-sm');
        const modes = { "": "Non spécifié", "ESPECE": "Espèce", "CHEQUE": "Chèque", "CARTE": "Carte Bancaire", "VIREMENT": "Virement" };
        for (const key in modes) {
            const option = document.createElement('option');
            option.value = key; option.textContent = modes[key];
            if (key === (originalValue || "")) option.selected = true;
            inputElement.appendChild(option);
        }
    } else if (columnName === 'date_paiement') {
        inputElement = document.createElement('input');
        inputElement.type = 'date'; 
        inputElement.classList.add('form-input-sm');
        inputElement.value = originalValue ? (originalValue.includes('T') ? originalValue.split('T')[0] : originalValue) : '';
    } else return; 
    
    if (inputElement) {
        inputElement.style.width = '100%';
        cell.appendChild(inputElement);
        inputElement.focus();
        inputElement.addEventListener('blur', async (e) => {
            const relatedTarget = e.relatedTarget;
            const currentRow = cell.closest('tr');
            if (relatedTarget && currentRow && currentRow.contains(relatedTarget) && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'SELECT')) return; 
            await saveRowChanges(cell.parentElement, seance);
        });
        inputElement.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') { e.preventDefault(); await saveRowChanges(cell.parentElement, seance); } 
            else if (e.key === 'Escape') { revertRowToDisplayMode(cell.parentElement, seance); state.setCurrentlyEditingRow(null); }
        });
    }
}

function togglePaymentFieldsInRow(row, seance, currentStatut) {
    const modePaiementCell = row.querySelector('td[data-column="mode_paiement"]');
    const datePaiementCell = row.querySelector('td[data-column="date_paiement"]');
    if (!modePaiementCell || !datePaiementCell) return;

    if (currentStatut === 'PAYEE') {
        if (!modePaiementCell.querySelector('select')) makeCellEditable(modePaiementCell, seance, 'mode_paiement');
        if (!datePaiementCell.querySelector('input[type="date"]')) {
            let seanceForDateEdit = {...seance}; 
            if (!seanceForDateEdit.date_paiement) seanceForDateEdit.date_paiement = new Date().toISOString().split('T')[0];
            makeCellEditable(datePaiementCell, seanceForDateEdit, 'date_paiement');
        }
    } else { 
        if (modePaiementCell.querySelector('select')) modePaiementCell.innerHTML = seance.mode_paiement || '-';
        if (datePaiementCell.querySelector('input[type="date"]')) datePaiementCell.innerHTML = seance.date_paiement ? new Date(seance.date_paiement).toLocaleDateString('fr-FR') : '-';
    }
}

async function saveRowChanges(row, seanceRef) { 
    if (!row || !row.dataset || !row.dataset.seanceId || !seanceRef) {
        if (row) revertRowToDisplayMode(row, seanceRef); 
        state.setCurrentlyEditingRow(null); return;
    }
    const seanceId = row.dataset.seanceId;
    let seanceToUpdate = { ...state.seances.find(s => s.id_seance === seanceId) }; 
    if (!seanceToUpdate) {
        showToast("Erreur: Séance non trouvée.", "error");
        revertRowToDisplayMode(row, null); 
        state.setCurrentlyEditingRow(null); return;
    }

    let hasChanges = false;
    const statutSelectElement = row.querySelector('td[data-column="statut_seance"] select');
    if (statutSelectElement && seanceToUpdate.statut_seance !== statutSelectElement.value) {
        seanceToUpdate.previous_statut_seance = seanceToUpdate.statut_seance;
        seanceToUpdate.statut_seance = statutSelectElement.value; 
        hasChanges = true;
    }

    const modePaiementSelectElement = row.querySelector('td[data-column="mode_paiement"] select');
    const datePaiementInputElement = row.querySelector('td[data-column="date_paiement"] input[type="date"]');
    if (seanceToUpdate.statut_seance === 'PAYEE') {
        const newModePaiement = modePaiementSelectElement ? (modePaiementSelectElement.value || null) : seanceToUpdate.mode_paiement;
        if (seanceToUpdate.mode_paiement !== newModePaiement) { seanceToUpdate.mode_paiement = newModePaiement; hasChanges = true; }
        
        const newDatePaiement = datePaiementInputElement ? (datePaiementInputElement.value || null) : seanceToUpdate.date_paiement;
        const oldDatePaiementNormalized = seanceToUpdate.date_paiement ? (seanceToUpdate.date_paiement.includes('T') ? seanceToUpdate.date_paiement.split('T')[0] : seanceToUpdate.date_paiement) : null;
        if (oldDatePaiementNormalized !== newDatePaiement) { seanceToUpdate.date_paiement = newDatePaiement; hasChanges = true; }
    } else { 
        if (seanceToUpdate.mode_paiement !== null) { seanceToUpdate.mode_paiement = null; hasChanges = true; }
        if (seanceToUpdate.date_paiement !== null) { seanceToUpdate.date_paiement = null; hasChanges = true; }
    }

    if (!hasChanges) {
        revertRowToDisplayMode(row, seanceToUpdate); 
        state.setCurrentlyEditingRow(null); return;
    }

    try {
        const result = await api.saveSeance(seanceToUpdate);
        showToast(result.message || 'Séance mise à jour.', 'success');
        const updatedSeanceFromServer = result.updatedSeance || seanceToUpdate; 
        state.updateSeanceInState(updatedSeanceFromServer);
        revertRowToDisplayMode(row, state.seances.find(s => s.id_seance === seanceId)); 
    } catch (error) {
        showToast(`Erreur MAJ séance: ${error.message}`, 'error');
        revertRowToDisplayMode(row, seanceRef);
    } finally { 
        state.setCurrentlyEditingRow(null); 
    }
}

function revertRowToDisplayMode(row, seance) {
    if (!row) return;
    const seanceId = row.dataset.seanceId;
    if (!seance && seanceId) seance = state.seances.find(s => s.id_seance === seanceId); 
    
    if (!seance) { 
         row.querySelectorAll('td[data-column]').forEach(cell => {
            if (cell.firstChild && (cell.firstChild.tagName === 'INPUT' || cell.firstChild.tagName === 'SELECT')) {
                cell.innerHTML = '-'; 
            }
         });
        const invoiceCell = row.querySelector('.invoice-cell');
        if (invoiceCell) invoiceCell.innerHTML = '-';
        const actionsCell = row.querySelector('.actions-cell');
        if (actionsCell) actionsCell.innerHTML = '-';
        return;
    }

    const statutCell = row.querySelector('td[data-column="statut_seance"]');
    if (statutCell) {
        let statutText = seance.statut_seance;
        if(seance.statut_seance === 'APAYER') statutText = 'À Payer';
        else if(seance.statut_seance === 'PAYEE') statutText = 'Payée';
        else if(seance.statut_seance === 'ANNULEE') statutText = 'Annulée';
        else if(seance.statut_seance === 'PLANIFIEE') statutText = 'Planifiée';
        statutCell.innerHTML = statutText;
    }
    const modePaiementCell = row.querySelector('td[data-column="mode_paiement"]');
    if (modePaiementCell) modePaiementCell.innerHTML = seance.mode_paiement || '-';
    
    const datePaiementCell = row.querySelector('td[data-column="date_paiement"]');
    if (datePaiementCell) datePaiementCell.innerHTML = seance.date_paiement ? new Date(seance.date_paiement).toLocaleDateString('fr-FR') : '-';
    
    const invoiceCell = row.querySelector('.invoice-cell');
    const actionsCell = row.querySelector('.actions-cell');

    if (invoiceCell && seance) { 
        invoiceCell.innerHTML = ''; 
        if (actionsCell) actionsCell.innerHTML = ''; 
        
        const createDocumentLink = (docNumber) => {
            const link = document.createElement('a');
            link.href = `/api/documents/view/${docNumber}.pdf`;
            link.textContent = docNumber;
            link.target = '_blank';
            link.style.marginRight = '5px';
            return link;
        };

        // MODIFIÉ : Logique de décision basée sur le début de la séance
        const now = new Date();
        const seanceStart = new Date(seance.date_heure_seance);
        const showDevisLogic = now < seanceStart;
        const client = state.clients.find(c => c.id === seance.id_client);

        if (showDevisLogic) {
            if (seance.devis_number) {
                invoiceCell.appendChild(createDocumentLink(seance.devis_number));
                const emailDevisBtn = document.createElement('button');
                emailDevisBtn.innerHTML = '<img class="brightness" src="pictures/sendEmail.png" alt="Envoyer devis" style="height: 1.3em; vertical-align: middle;">';
                emailDevisBtn.classList.add('btn', 'btn-primary', 'btn-sm');
                emailDevisBtn.title = 'Envoyer le devis par email'; emailDevisBtn.style.padding = '0.1rem 0.2rem';
                emailDevisBtn.onclick = (e) => { e.stopPropagation(); handleSendDevisByEmail(seance.id_seance, seance.devis_number, client ? client.email : null);};
                invoiceCell.appendChild(emailDevisBtn);
            } else if (!seance.invoice_number) {
                const btnGenererDevis = document.createElement('button');
                btnGenererDevis.textContent = 'Devis';
                btnGenererDevis.classList.add('btn', 'btn-primary', 'btn-sm');
                btnGenererDevis.onclick = (e) => { e.stopPropagation(); handleGenerateDevis(seance.id_seance); };
                invoiceCell.appendChild(btnGenererDevis);
            } else { 
                 invoiceCell.appendChild(createDocumentLink(seance.invoice_number));
            }
        } else { // La séance a commencé ou est passée
            if (seance.invoice_number) {
                invoiceCell.appendChild(createDocumentLink(seance.invoice_number));
                const emailBtn = document.createElement('button');
                emailBtn.innerHTML = '<img class="brightness" src="pictures/sendEmail.png" alt="Envoyer facture" style="height: 1.3em; vertical-align: middle;">';
                emailBtn.classList.add('btn', 'btn-success', 'btn-sm');
                emailBtn.title = 'Envoyer la facture par email'; emailBtn.style.padding = '0.1rem 0.2rem';
                emailBtn.onclick = (e) => { e.stopPropagation(); handleSendInvoiceByEmail(seance.id_seance, seance.invoice_number, client ? client.email : null);};
                invoiceCell.appendChild(emailBtn);
            } else {
                if (seance.devis_number) {
                    const devisInfo = document.createElement('span');
                    devisInfo.textContent = `(Devis: ${seance.devis_number}) `; devisInfo.style.fontSize = '0.8em'; devisInfo.style.marginRight = '3px';
                    invoiceCell.appendChild(devisInfo);
                }
                const btnFacturer = document.createElement('button');
                btnFacturer.textContent = 'Facturer'; btnFacturer.classList.add('btn', 'btn-success', 'btn-sm');
                btnFacturer.onclick = (e) => { e.stopPropagation(); handleGenerateInvoice(seance.id_seance); };
                invoiceCell.appendChild(btnFacturer);
            }
        }
        if (actionsCell) {
            if (!seance.invoice_number) {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Modifier'; editBtn.classList.add('btn', 'btn-warning', 'btn-sm'); editBtn.style.marginRight = '5px';
                editBtn.onclick = (e) => { e.stopPropagation(); resetAndOpenSeanceForm(seance.id_seance);};
                actionsCell.appendChild(editBtn);
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '&#x1F5D1;';
                deleteBtn.title = 'Supprimer';
                deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'btn-icon-delete');
                deleteBtn.onclick = (e) => { e.stopPropagation(); openDeleteModal(seance.id_seance, 'seance', `Séance du ${new Date(seance.date_heure_seance).toLocaleDateString()}`);};
                actionsCell.appendChild(deleteBtn);
            } else { actionsCell.textContent = '-'; }
        }
    } else if (invoiceCell) { 
        invoiceCell.innerHTML = '-'; 
        if (actionsCell) actionsCell.innerHTML = '-';
    }
}


export function initializeSeanceManagement() {
    if (dom.btnAddSeance) dom.btnAddSeance.addEventListener('click', () => resetAndOpenSeanceForm());
    if (dom.cancelSeanceFormBtn) dom.cancelSeanceFormBtn.addEventListener('click', closeSeanceForm);
    
    if (dom.seanceClientNameInput) {
        dom.seanceClientNameInput.addEventListener('input', () => {
            const searchTerm = dom.seanceClientNameInput.value.toLowerCase();
            if(dom.clientAutocompleteResults) dom.clientAutocompleteResults.innerHTML = ''; else return;
            if (searchTerm.length < 1) { dom.clientAutocompleteResults.classList.add('hidden'); return; }
            
            const activeClients = state.clients.filter(c => c.statut === 'actif');
            const matchedClients = activeClients.filter(client => 
                (client.nom?.toLowerCase() || '').includes(searchTerm) || 
                (client.prenom?.toLowerCase() || '').includes(searchTerm)
            );

            if (matchedClients.length > 0) {
                matchedClients.forEach(client => {
                    const div = document.createElement('div');
                    div.textContent = `${client.prenom} ${client.nom}`;
                    div.onclick = () => {
                        dom.seanceClientNameInput.value = `${client.prenom} ${client.nom}`;
                        dom.seanceClientIdInput.value = client.id;
                        if (dom.clientAutocompleteResults) {
                           dom.clientAutocompleteResults.innerHTML = '';
                           dom.clientAutocompleteResults.classList.add('hidden');
                        }
                        if (client.defaultTarifId && state.tarifs.find(t => t.id === client.defaultTarifId)) {
                            dom.seanceTarifSelect.value = client.defaultTarifId;
                            updateSeanceMontant();
                        } else {
                            dom.seanceTarifSelect.value = ''; 
                            dom.seanceMontantInput.value = '';
                        }
                    };
                    if (dom.clientAutocompleteResults) dom.clientAutocompleteResults.appendChild(div);
                });
                if (dom.clientAutocompleteResults) dom.clientAutocompleteResults.classList.remove('hidden');
            } else { 
                if (dom.clientAutocompleteResults) dom.clientAutocompleteResults.classList.add('hidden'); 
            }
        });
    }
    document.addEventListener('click', function(event) { 
        if (dom.seanceClientNameInput && dom.clientAutocompleteResults && 
            !dom.seanceClientNameInput.contains(event.target) && 
            !dom.clientAutocompleteResults.contains(event.target)) {
            dom.clientAutocompleteResults.classList.add('hidden');
        }
    });

    if (dom.seanceTarifSelect) dom.seanceTarifSelect.addEventListener('change', updateSeanceMontant);
    if (dom.seanceStatutSelect) dom.seanceStatutSelect.addEventListener('change', (e) => toggleSeancePaymentFields(e.target.value));
    if (dom.seanceForm) dom.seanceForm.addEventListener('submit', handleSeanceFormSubmit);

    applyDefaultSeanceDateFilters();

    if (dom.searchSeanceClientInput) dom.searchSeanceClientInput.addEventListener('input', renderSeancesTable);
    if (dom.filterSeanceStatut) dom.filterSeanceStatut.addEventListener('change', renderSeancesTable);
    if (dom.filterSeanceDateStart) dom.filterSeanceDateStart.addEventListener('input', renderSeancesTable);
    if (dom.filterSeanceDateEnd) dom.filterSeanceDateEnd.addEventListener('input', renderSeancesTable);
    
    if (dom.clearSeanceFiltersBtn) {
        dom.clearSeanceFiltersBtn.addEventListener('click', () => {
            if(dom.searchSeanceClientInput) dom.searchSeanceClientInput.value = '';
            if(dom.filterSeanceStatut) dom.filterSeanceStatut.value = '';
            if(dom.filterSeanceDateStart) dom.filterSeanceDateStart.value = '';
            if(dom.filterSeanceDateEnd) dom.filterSeanceDateEnd.value = '';
            renderSeancesTable(); 
        });
    }

    document.addEventListener('click', async (event) => {
        if (state.currentlyEditingRow && !state.currentlyEditingRow.contains(event.target)) {
            let targetIsActionButtonInSameRow = false;
            if (event.target.closest('tr') === state.currentlyEditingRow && 
                (event.target.tagName === 'BUTTON' || (event.target.tagName === 'IMG' && event.target.closest('button')))) {
                targetIsActionButtonInSameRow = true;
            }
            if (!targetIsActionButtonInSameRow) {
                const seanceId = state.currentlyEditingRow.dataset.seanceId;
                const seance = state.seances.find(s => s.id_seance === seanceId);
                if (seance) await saveRowChanges(state.currentlyEditingRow, seance); 
                else { 
                    revertRowToDisplayMode(state.currentlyEditingRow, null); 
                    state.setCurrentlyEditingRow(null); 
                }
            }
        }
    });

    if (dom.seanceDateElement) {
        dom.seanceDateElement.addEventListener('change', function() {
            if (!this.value) return;
            try {
                const dateValue = new Date(this.value);
                if (isNaN(dateValue.getTime())) return; 

                let currentMinutes = dateValue.getMinutes();
                const roundedMinutes = Math.round(currentMinutes / 15) * 15;

                dateValue.setSeconds(0);
                dateValue.setMilliseconds(0);

                if (roundedMinutes >= 60) {
                    dateValue.setHours(dateValue.getHours() + 1); 
                    dateValue.setMinutes(0);
                } else {
                    dateValue.setMinutes(roundedMinutes);
                }
                
                const year = dateValue.getFullYear();
                const month = (dateValue.getMonth() + 1).toString().padStart(2, '0');
                const day = dateValue.getDate().toString().padStart(2, '0');
                const hours = dateValue.getHours().toString().padStart(2, '0');
                const finalMinutes = dateValue.getMinutes().toString().padStart(2, '0');
                this.value = `${year}-${month}-${day}T${hours}:${finalMinutes}`;
            } catch (e) {
                console.warn("Erreur lors de l'ajustement de la date/heure de la séance (change):", e);
            }
        });
    }
}