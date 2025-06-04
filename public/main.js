// main.js
const API_BASE_URL = 'http://fact.lpz.ovh:3000/api';
const INVOICE_PREVIEW_BASE_URL = 'http://fact.lpz.ovh';

// --- État global de l'application ---
let clients = [];
let tarifs = [];
let seances = [];
let appSettings = {}; // Sera chargé avec GMAIL_USER et GMAIL_APP_PASSWORD (ce dernier ne sera pas stocké côté client après test)
let currentlyEditingRow = null;

let editingClientId = null;
let editingTarifId = null;
let editingSeanceId = null;
let itemToDelete = { id: null, type: null };

// --- Éléments DOM (Mis en cache) ---
// Navigation
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
// Clients
const clientFormContainer = document.getElementById('clientFormContainer');
const clientForm = document.getElementById('clientForm');
const clientFormTitle = document.getElementById('clientFormTitle');
const clientsTableBody = document.querySelector('#clientsTable tbody');
const btnAddClient = document.getElementById('btnAddClient');
const cancelClientFormBtn = document.getElementById('cancelClientForm');
const searchClientInput = document.getElementById('searchClientInput');
const filterClientStatut = document.getElementById('filterClientStatut');
const clientDefaultTarifSelect = document.getElementById('clientDefaultTarif');
const clientVilleInput = document.getElementById('clientVille');

// Tarifs
const tarifFormContainer = document.getElementById('tarifFormContainer');
const tarifForm = document.getElementById('tarifForm');
const tarifFormTitle = document.getElementById('tarifFormTitle');
const tarifsTableBody = document.querySelector('#tarifsTable tbody');
const btnAddTarif = document.getElementById('btnAddTarif');
const cancelTarifFormBtn = document.getElementById('cancelTarifForm');
const tarifDureeInput = document.getElementById('tarifDuree'); // Nouveau champ Durée

// Séances
const seanceFormContainer = document.getElementById('seanceFormContainer');
const seanceForm = document.getElementById('seanceForm');
const seanceFormTitle = document.getElementById('seanceFormTitle');
const seancesTableBody = document.querySelector('#seancesTable tbody');
const btnAddSeance = document.getElementById('btnAddSeance');
const cancelSeanceFormBtn = document.getElementById('cancelSeanceForm');
const seanceClientNameInput = document.getElementById('seanceClientNameInput');
if (seanceClientNameInput) {
    seanceClientNameInput.setAttribute('autocomplete', 'off');
}
const seanceClientIdInput = document.getElementById('seanceClientIdInput');
const clientAutocompleteResults = document.getElementById('clientAutocompleteResults');
const seanceTarifSelect = document.getElementById('seanceTarif');
const seanceMontantInput = document.getElementById('seanceMontant');
const seanceStatutSelect = document.getElementById('seanceStatut');
const seanceModePaiementGroup = document.getElementById('seanceModePaiementGroup');
const seanceDatePaiementGroup = document.getElementById('seanceDatePaiementGroup');
const seanceModePaiementSelect = document.getElementById('seanceModePaiement');
const seanceDatePaiementInput = document.getElementById('seanceDatePaiement');
const searchSeanceClientInput = document.getElementById('searchSeanceClientInput');
const filterSeanceStatut = document.getElementById('filterSeanceStatut');
const filterSeanceDateStart = document.getElementById('filterSeanceDateStart');
const filterSeanceDateEnd = document.getElementById('filterSeanceDateEnd');
const clearSeanceFiltersBtn = document.getElementById('clearSeanceFilters');
// Dashboard Chart
const chartPeriodSelector = document.getElementById('chartPeriodSelector');
const sessionsTrendChartContainer = document.getElementById('sessionsTrendChartContainer');

// Modale
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const deleteModalTitle = document.getElementById('deleteModalTitle');
const deleteModalMessage = document.getElementById('deleteModalMessage');

// Éléments DOM pour la section Config
const configForm = document.getElementById('configForm');
const configManagerName = document.getElementById('configManagerName');
const configManagerTitle = document.getElementById('configManagerTitle');
const configManagerDescription = document.getElementById('configManagerDescription');
const configManagerAddress = document.getElementById('configManagerAddress');
const configManagerCity = document.getElementById('configManagerCity');
const configManagerPhone = document.getElementById('configManagerPhone');
const configManagerEmail = document.getElementById('configManagerEmail'); // GMAIL_USER
const configGmailAppPassword = document.getElementById('configGmailAppPassword'); // GMAIL_APP_PASSWORD
const gmailTestResultDiv = document.getElementById('gmailTestResult');
const configTva = document.getElementById('configTva');
const configSiret = document.getElementById('configSiret');
const configApe = document.getElementById('configApe');
const configAdeli = document.getElementById('configAdeli');
const configIban = document.getElementById('configIban');
const configBic = document.getElementById('configBic');
const configTvaMention = document.getElementById('configTvaMention');
const configPaymentTerms = document.getElementById('configPaymentTerms');
const configInsurance = document.getElementById('configInsurance');


// --- Fonctions Utilitaires ---
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function showToast(message, type = 'info') {
    // Détermine le type basé sur le message si non explicitement 'success' ou 'error'
    if (type !== 'success' && type !== 'error') {
        if (message.toLowerCase().includes('succès') || message.toLowerCase().includes('succes') || message.toLowerCase().includes('envoyée') || message.toLowerCase().includes('réussie')) type = 'success';
        else if (message.toLowerCase().includes('erreur') || message.toLowerCase().includes('échec')) type = 'error';
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '1.5rem';
    toast.style.right = '1.5rem';
    toast.style.zIndex = 2000;
    toast.style.minWidth = '220px';
    toast.style.padding = '1rem 1.5rem';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    toast.style.color = 'white';
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '1rem';
    toast.style.opacity = '0.97';
    toast.style.transition = 'opacity 0.3s, transform 0.3s'; // Ajout transform pour animation
    toast.style.transform = 'translateX(110%)'; // Position initiale hors écran

    if (type === 'success') {
        toast.style.background = '#28a745';
    } else if (type === 'error') {
        toast.style.background = '#dc3545';
    } else { 
        toast.style.background = '#007bff'; 
        if (type === 'warning') toast.style.background = '#ffc107';
    }

    document.body.appendChild(toast);
    
    // Animation d'apparition
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 50);

    // Animation de disparition
    setTimeout(() => {
        toast.style.transform = 'translateX(110%)'; // Sort de l'écran
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400); // Supprime après la transition
    }, 3500); // Durée d'affichage avant de commencer à disparaître
}


// --- Navigation ---
function switchView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    navButtons.forEach(btn => btn.classList.remove('active'));
    const currentView = document.getElementById(viewId);
    if (currentView) currentView.classList.add('active');
    const currentNavButton = document.getElementById('nav' + viewId.substring(3));
    if (currentNavButton) currentNavButton.classList.add('active');

    if (viewId === 'viewDashboard') {
        updateDashboardStats();
    } else if (viewId === 'viewConfig') {
        populateConfigForm();
    } else if (viewId === 'viewSeances') {
        if (seances.length > 0) renderSeancesTable();
    }
}
navButtons.forEach(button => button.addEventListener('click', () => switchView('view' + button.id.substring(3))));

// --- Modale de Suppression ---
function openDeleteModal(id, type, itemName) {
    itemToDelete = { id, type };
    deleteModalTitle.textContent = `Confirmation de suppression`;
    deleteModalMessage.textContent = `Êtes-vous sûr de vouloir supprimer "${itemName}" ? Cette action est irréversible.`;
    deleteConfirmModal.style.display = 'block';
}
confirmDeleteBtn.addEventListener('click', async () => {
    if (itemToDelete.id && itemToDelete.type) {
        try {
            let response;
            let endpoint = '';
            let successMessage = '';

            if (itemToDelete.type === 'client') {
                endpoint = `${API_BASE_URL}/clients/${itemToDelete.id}`;
                successMessage = 'Client supprimé avec succès.';
            } else if (itemToDelete.type === 'tarif') {
                endpoint = `${API_BASE_URL}/tarifs/${itemToDelete.id}`;
                successMessage = 'Tarif supprimé avec succès.';
            } else if (itemToDelete.type === 'seance') {
                 const seance = seances.find(s => s.id_seance === itemToDelete.id);
                 if (seance && seance.invoice_number) {
                    showToast("Impossible de supprimer une séance facturée.", "error");
                    closeDeleteModal();
                    return;
                 }
                endpoint = `${API_BASE_URL}/seances/${itemToDelete.id}`;
                successMessage = 'Séance supprimée avec succès.';
            }

            if (endpoint) {
                response = await fetch(endpoint, { method: 'DELETE' });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erreur lors de la suppression.`);
                }
                showToast(successMessage);
                if (itemToDelete.type === 'client') { await fetchClients(); await fetchSeances(); }
                else if (itemToDelete.type === 'tarif') { await fetchTarifs(); await fetchClients(); await fetchSeances(); }
                else if (itemToDelete.type === 'seance') { await fetchSeances(); }
            }
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
            console.error('Erreur de suppression :', error);
        }
    }
    closeDeleteModal();
});
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
function closeDeleteModal() {
    deleteConfirmModal.style.display = 'none';
    itemToDelete = { id: null, type: null };
}
window.onclick = (event) => { if (event.target == deleteConfirmModal) closeDeleteModal(); };


// --- Fonctions de récupération API ---
async function fetchClients() {
    try {
        const response = await fetch(`${API_BASE_URL}/clients`);
        if (!response.ok) throw new Error('Échec de la récupération des clients');
        clients = await response.json();
        renderClientsTable();
        populateTarifDropdowns(); // Assurer que les tarifs sont dispo pour les listes déroulantes client
        updateDashboardStats();
    } catch (error) {
        showToast(`Erreur chargement clients: ${error.message}`, 'error');
        console.error('Erreur de récupération des clients :', error);
    }
}

async function fetchTarifs() {
    try {
        const response = await fetch(`${API_BASE_URL}/tarifs`);
        if (!response.ok) throw new Error('Échec de la récupération des tarifs');
        tarifs = await response.json();
        renderTarifsTable();
        populateTarifDropdowns();
        if(clients.length > 0) renderClientsTable(); // Mettre à jour la table client si elle dépend des tarifs
        updateDashboardStats();
    } catch (error) {
        showToast(`Erreur chargement tarifs: ${error.message}`, 'error');
        console.error('Erreur de récupération des tarifs :', error);
    }
}

async function fetchSeances() {
    try {
        const response = await fetch(`${API_BASE_URL}/seances`);
        if (!response.ok) throw new Error('Échec de la récupération des séances');
        seances = await response.json();
        console.log("Séances récupérées:", seances);
        renderSeancesTable();
        updateDashboardStats();
    } catch (error)
 {
        showToast(`Erreur chargement séances: ${error.message}`, 'error');
        console.error('Erreur de récupération des séances :', error);
    }
}

async function fetchSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (!response.ok) throw new Error('Échec de la récupération des paramètres');
        appSettings = await response.json();
        if (document.getElementById('viewConfig').classList.contains('active')) {
            populateConfigForm();
        }
    } catch (error) {
        showToast(`Erreur chargement paramètres: ${error.message}`, 'error');
        console.error('Erreur de récupération des paramètres :', error);
        appSettings = { // Default structure if fetch fails
            manager: { name: "", title: "", description: "", address: "", city: "", phone: "", email: "", gmailAppPasswordStatus: "" }, // Added gmailAppPasswordStatus
            tva: 0,
            legal: { siret: "", ape: "", adeli: "", iban: "", bic: "", tvaMention: "TVA non applicable - Art. 293B du CGI", paymentTerms: "Paiement à réception de facture", insurance: "" }
        };
        if (document.getElementById('viewConfig').classList.contains('active')) {
             populateConfigForm();
        }
    }
}


// --- Gestion des Clients ---
function populateTarifDropdowns() {
    const tarifOptions = tarifs.map(t => {
        // Ajout de la durée dans le libellé du dropdown si elle existe
        const dureeText = t.duree ? ` (${t.duree} min)` : '';
        return `<option value="${t.id}">${t.libelle}${dureeText} - ${parseFloat(t.montant).toFixed(2)}€</option>`;
    }).join('');
    if (clientDefaultTarifSelect) clientDefaultTarifSelect.innerHTML = '<option value="">Aucun</option>' + tarifOptions;
    if (seanceTarifSelect) seanceTarifSelect.innerHTML = '<option value="">Sélectionner un tarif</option>' + tarifOptions;
}

if (btnAddClient) btnAddClient.addEventListener('click', () => {
    editingClientId = null;
    clientFormTitle.textContent = 'Ajouter un nouveau client';
    clientForm.reset();
    document.getElementById('clientId').value = '';
    populateTarifDropdowns();
    if (clientDefaultTarifSelect) clientDefaultTarifSelect.value = "";
    clientFormContainer.classList.remove('hidden');
});
if (cancelClientFormBtn) cancelClientFormBtn.addEventListener('click', () => {
    clientFormContainer.classList.add('hidden');
    clientForm.reset();
    editingClientId = null;
});

if (clientForm) clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clientData = {
        nom: document.getElementById('clientNom').value,
        prenom: document.getElementById('clientPrenom').value,
        telephone: document.getElementById('clientTelephone').value,
        email: document.getElementById('clientEmail').value,
        adresse: document.getElementById('clientAdresse').value,
        ville: clientVilleInput.value,
        notes: document.getElementById('clientNotes').value,
        defaultTarifId: clientDefaultTarifSelect.value || null,
        statut: editingClientId ? clients.find(c => c.id === editingClientId).statut : 'actif',
        dateCreation: editingClientId ? clients.find(c => c.id === editingClientId).dateCreation : new Date().toISOString()
    };

    if (editingClientId) {
        clientData.id = editingClientId;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        if (!response.ok) throw new Error('Échec de la sauvegarde du client');
        await fetchClients();
        clientFormContainer.classList.add('hidden');
        clientForm.reset();
        editingClientId = null;
        showToast('Client enregistré avec succès.');
    } catch (error) {
        showToast(`Erreur sauvegarde client: ${error.message}`, 'error');
        console.error('Erreur de sauvegarde du client :', error);
    }
});

async function toggleClientStatus(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        client.statut = client.statut === 'actif' ? 'inactif' : 'actif';
        try {
            const response = await fetch(`${API_BASE_URL}/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
            if (!response.ok) throw new Error('Échec de la mise à jour du statut du client');
            renderClientsTable();
            showToast('Statut client mis à jour.');
        } catch (error) {
            client.statut = client.statut === 'actif' ? 'inactif' : 'actif'; // Revert on error
            showToast(`Erreur mise à jour statut client: ${error.message}`, 'error');
            console.error('Erreur de bascule de statut :', error);
        }
    }
}

function renderClientsTable() {
    if (!clientsTableBody) return;
    clientsTableBody.innerHTML = '';
    const searchTerm = searchClientInput ? searchClientInput.value.toLowerCase() : "";
    const statutFilter = filterClientStatut ? filterClientStatut.value : "";

    const filteredClients = clients.filter(client =>
        (client.nom.toLowerCase().includes(searchTerm) || client.prenom.toLowerCase().includes(searchTerm)) &&
        (statutFilter === "" || client.statut === statutFilter)
    );

    if (filteredClients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Aucun client trouvé.</td></tr>';
        return;
    }

    filteredClients.forEach(client => {
        const row = clientsTableBody.insertRow();
        row.insertCell().textContent = client.nom;
        row.insertCell().textContent = client.prenom;
        row.insertCell().textContent = client.telephone || '-';
        row.insertCell().textContent = client.email || '-';
        row.insertCell().textContent = client.adresse || '-';
        row.insertCell().textContent = client.ville || '-';

        const statusCell = row.insertCell();
        statusCell.classList.add('status-cell');
        const statusCheckbox = document.createElement('input');
        statusCheckbox.type = 'checkbox';
        statusCheckbox.checked = client.statut === 'actif';
        statusCheckbox.title = client.statut === 'actif' ? 'Client actif (cliquer pour désactiver)' : 'Client inactif (cliquer pour activer)';
        statusCheckbox.onchange = () => toggleClientStatus(client.id);
        statusCell.appendChild(statusCheckbox);

        const defaultTarif = tarifs.find(t => t.id === client.defaultTarifId);
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
        editBtn.textContent = 'Modifier'; editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        editBtn.style.marginRight = '5px'; editBtn.onclick = () => loadClientForEdit(client.id);
        actionsCell.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.onclick = () => openDeleteModal(client.id, 'client', `${client.prenom} ${client.nom}`);
        actionsCell.appendChild(deleteBtn);
    });
}
if(searchClientInput) searchClientInput.addEventListener('input', renderClientsTable);
if(filterClientStatut) filterClientStatut.addEventListener('change', renderClientsTable);

function loadClientForEdit(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        editingClientId = clientId;
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientNom').value = client.nom;
        document.getElementById('clientPrenom').value = client.prenom;
        document.getElementById('clientTelephone').value = client.telephone || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientAdresse').value = client.adresse || '';
        if (clientVilleInput) clientVilleInput.value = client.ville || '';
        document.getElementById('clientNotes').value = client.notes || '';
        populateTarifDropdowns();
        if (clientDefaultTarifSelect) clientDefaultTarifSelect.value = client.defaultTarifId || "";
        clientFormTitle.textContent = 'Modifier le client';
        clientFormContainer.classList.remove('hidden');
    }
}


// --- Gestion des Tarifs ---
if (btnAddTarif) btnAddTarif.addEventListener('click', () => {
    editingTarifId = null;
    tarifFormTitle.textContent = 'Ajouter un nouveau tarif';
    tarifForm.reset();
    document.getElementById('tarifId').value = '';
    if (tarifDureeInput) tarifDureeInput.value = ''; // Reset durée
    tarifFormContainer.classList.remove('hidden');
});
if (cancelTarifFormBtn) cancelTarifFormBtn.addEventListener('click', () => {
    tarifFormContainer.classList.add('hidden');
    tarifForm.reset();
    editingTarifId = null;
});
if (tarifForm) tarifForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tarifData = {
        libelle: document.getElementById('tarifLibelle').value,
        montant: parseFloat(document.getElementById('tarifMontant').value),
        duree: tarifDureeInput.value ? parseInt(tarifDureeInput.value) : null // Ajout de la durée
    };

    if (editingTarifId) {
        tarifData.id = editingTarifId;
    }

    if (isNaN(tarifData.montant) || tarifData.montant < 0) {
        showToast("Le montant du tarif est invalide.", "error");
        return;
    }
    if (tarifData.duree !== null && (isNaN(tarifData.duree) || tarifData.duree < 0)) {
        showToast("La durée du tarif est invalide.", "error");
        return;
    }


    try {
        const response = await fetch(`${API_BASE_URL}/tarifs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tarifData)
        });
        if (!response.ok) throw new Error('Échec de la sauvegarde du tarif');
        await fetchTarifs(); // Recharge et re-render les tarifs
        tarifFormContainer.classList.add('hidden');
        tarifForm.reset();
        editingTarifId = null;
        showToast('Tarif enregistré avec succès.');
    } catch (error) {
        showToast(`Erreur sauvegarde tarif: ${error.message}`, 'error');
        console.error('Erreur de sauvegarde du tarif :', error);
    }
});

function renderTarifsTable() {
    if (!tarifsTableBody) return;
    tarifsTableBody.innerHTML = '';
    if (tarifs.length === 0) {
        tarifsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucun tarif défini.</td></tr>'; // Colspan à 4
        return;
    }
    tarifs.forEach(tarif => {
        const row = tarifsTableBody.insertRow();
        row.insertCell().textContent = tarif.libelle;
        row.insertCell().textContent = tarif.duree ? `${tarif.duree} min` : '-'; // Affichage de la durée
        row.insertCell().textContent = parseFloat(tarif.montant).toFixed(2) + ' €';
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Modifier'; editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        editBtn.style.marginRight = '5px'; editBtn.onclick = () => loadTarifForEdit(tarif.id);
        actionsCell.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Supprimer'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.onclick = () => openDeleteModal(tarif.id, 'tarif', tarif.libelle);
        actionsCell.appendChild(deleteBtn);
    });
}
function loadTarifForEdit(tarifId) {
    const tarif = tarifs.find(t => t.id === tarifId);
    if (tarif) {
        editingTarifId = tarifId;
        document.getElementById('tarifId').value = tarif.id;
        document.getElementById('tarifLibelle').value = tarif.libelle;
        document.getElementById('tarifMontant').value = parseFloat(tarif.montant).toFixed(2);
        if (tarifDureeInput) tarifDureeInput.value = tarif.duree || ''; // Chargement de la durée
        tarifFormTitle.textContent = 'Modifier le tarif';
        tarifFormContainer.classList.remove('hidden');
    }
}

// --- Gestion des Séances ---
if (btnAddSeance) btnAddSeance.addEventListener('click', () => {
    editingSeanceId = null;
    seanceFormTitle.textContent = 'Ajouter une nouvelle séance';
    seanceForm.reset();
    if (seanceClientIdInput) seanceClientIdInput.value = '';
    if (seanceClientNameInput) seanceClientNameInput.value = '';
    if (seanceClientIdInput) seanceClientIdInput.removeAttribute('data-client-id');
    document.getElementById('seanceId').value = '';
    populateTarifDropdowns();
    if (seanceTarifSelect) seanceTarifSelect.value = '';
    if (seanceMontantInput) seanceMontantInput.value = '';
    document.getElementById('seanceDate').value = new Date().toISOString().slice(0, 16); // Date actuelle par défaut
    if(seanceStatutSelect) seanceStatutSelect.value = 'PLANIFIEE'; // Statut par défaut
    toggleSeancePaymentFields('PLANIFIEE');
    seanceFormContainer.classList.remove('hidden');
});
if (cancelSeanceFormBtn) cancelSeanceFormBtn.addEventListener('click', () => {
    seanceFormContainer.classList.add('hidden');
    seanceForm.reset();
    editingSeanceId = null;
    if (clientAutocompleteResults) {
        clientAutocompleteResults.innerHTML = '';
        clientAutocompleteResults.classList.add('hidden');
    }
});

if (seanceClientNameInput) {
    seanceClientNameInput.addEventListener('input', () => {
        const searchTerm = seanceClientNameInput.value.toLowerCase();
        clientAutocompleteResults.innerHTML = '';
        if (searchTerm.length < 1) {
            clientAutocompleteResults.classList.add('hidden');
            return;
        }
        const activeClients = clients.filter(c => c.statut === 'actif');
        const matchedClients = activeClients.filter(client =>
            client.nom.toLowerCase().includes(searchTerm) || client.prenom.toLowerCase().includes(searchTerm)
        );
        if (matchedClients.length > 0) {
            matchedClients.forEach(client => {
                const div = document.createElement('div');
                div.textContent = `${client.prenom} ${client.nom}`;
                div.onclick = () => selectClientForSeance(client);
                clientAutocompleteResults.appendChild(div);
            });
            clientAutocompleteResults.classList.remove('hidden');
        } else {
            clientAutocompleteResults.classList.add('hidden');
        }
    });
    seanceClientNameInput.addEventListener('change', () => { // Auto-select if exact match on blur
        if (seanceClientNameInput.value && !seanceClientIdInput.value) {
            const clientNameFromInput = seanceClientNameInput.value.trim();
            const foundClient = clients.find(c =>
                `${c.prenom} ${c.nom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase() ||
                `${c.nom} ${c.prenom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase()
            );
            if (foundClient) {
                selectClientForSeance(foundClient);
            }
        }
    });
}


document.addEventListener('click', function(event) {
    if (seanceClientNameInput && clientAutocompleteResults && !seanceClientNameInput.contains(event.target) && !clientAutocompleteResults.contains(event.target)) {
        clientAutocompleteResults.classList.add('hidden');
    }
});


function selectClientForSeance(client) {
    seanceClientNameInput.value = `${client.prenom} ${client.nom}`;
    seanceClientIdInput.value = client.id;
    clientAutocompleteResults.innerHTML = '';
    clientAutocompleteResults.classList.add('hidden');
    // Pré-remplir le tarif par défaut du client
    if (client.defaultTarifId && tarifs.find(t => t.id === client.defaultTarifId)) {
        seanceTarifSelect.value = client.defaultTarifId;
        updateSeanceMontant();
    } else {
        seanceTarifSelect.value = ''; // Ou un autre tarif par défaut si configuré
        seanceMontantInput.value = '';
    }
}

if (seanceTarifSelect) seanceTarifSelect.addEventListener('change', updateSeanceMontant);

function updateSeanceMontant() {
    const selectedTarifId = seanceTarifSelect.value;
    const tarif = tarifs.find(t => t.id === selectedTarifId);
    if (tarif) {
        seanceMontantInput.value = parseFloat(tarif.montant).toFixed(2);
    } else {
        seanceMontantInput.value = '';
    }
}

if (seanceStatutSelect) seanceStatutSelect.addEventListener('change', (e) => toggleSeancePaymentFields(e.target.value));

function toggleSeancePaymentFields(statut) {
    if (!seanceModePaiementGroup || !seanceDatePaiementGroup) return;
    if (statut === 'PAYEE') {
        seanceModePaiementGroup.classList.remove('hidden');
        seanceDatePaiementGroup.classList.remove('hidden');
        if (!document.getElementById('seanceDatePaiement').value) { // Set current date if empty
             document.getElementById('seanceDatePaiement').valueAsDate = new Date();
        }
    } else {
        seanceModePaiementGroup.classList.add('hidden');
        seanceDatePaiementGroup.classList.add('hidden');
        if(seanceModePaiementSelect) seanceModePaiementSelect.value = '';
        if(document.getElementById('seanceDatePaiement')) document.getElementById('seanceDatePaiement').value = '';
    }
}

if (seanceForm) seanceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    let idClient = seanceClientIdInput.value;
    const clientNameFromInput = seanceClientNameInput.value.trim();

    // Vérification client
    if (!idClient && clientNameFromInput) { // Essayer de trouver le client si non sélectionné via autocomplete mais tapé
        const foundClient = clients.find(c =>
            `${c.prenom} ${c.nom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase() ||
            `${c.nom} ${c.prenom}`.trim().toLowerCase() === clientNameFromInput.toLowerCase()
        );
        if (foundClient) {
            idClient = foundClient.id;
            seanceClientIdInput.value = idClient; // Mettre à jour l'ID caché
        }
    }

    if (!idClient || !clients.find(c => c.id === idClient)) {
        showToast("Client invalide. Veuillez sélectionner un client dans la liste.", "error");
        return;
    }

    const idTarif = seanceTarifSelect.value;
     if (!idTarif || !tarifs.find(t => t.id === idTarif)) {
        showToast("Veuillez sélectionner un tarif valide.", "error"); return;
    }
    const montant = parseFloat(seanceMontantInput.value);
    if (isNaN(montant)) {
        showToast("Montant invalide. Vérifiez le tarif sélectionné.", "error"); return;
    }

    const seanceData = {
        id_seance: document.getElementById('seanceId').value || generateUUID(),
        id_client: idClient,
        date_heure_seance: document.getElementById('seanceDate').value,
        id_tarif: idTarif,
        montant_facture: montant,
        statut_seance: seanceStatutSelect.value,
        mode_paiement: seanceStatutSelect.value === 'PAYEE' ? (seanceModePaiementSelect.value || null) : null,
        date_paiement: seanceStatutSelect.value === 'PAYEE' && document.getElementById('seanceDatePaiement').value ? document.getElementById('seanceDatePaiement').value : null,
        invoice_number: editingSeanceId ? (seances.find(s => s.id_seance === editingSeanceId)?.invoice_number || null) : null,
        devis_number: editingSeanceId ? (seances.find(s => s.id_seance === editingSeanceId)?.devis_number || null) : null,
        // googleCalendarEventId sera géré côté serveur
    };

    try {
        const response = await fetch(`${API_BASE_URL}/seances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seanceData) // Envoi de la nouvelle séance ou de la séance modifiée
        });
        const result = await response.json(); // Récupérer la réponse du serveur
        if (!response.ok) throw new Error(result.message || 'Échec de la sauvegarde de la séance');
        
        await fetchSeances(); // Recharger toutes les séances
        seanceFormContainer.classList.add('hidden');
        seanceForm.reset();
        editingSeanceId = null;
        showToast(result.message || 'Séance enregistrée avec succès.'); // Afficher le message du serveur
    } catch (error) {
        showToast(`Erreur sauvegarde séance: ${error.message}`, 'error');
        console.error('Erreur de sauvegarde de la séance :', error);
    }
});


function renderSeancesTable() {
    if (!seancesTableBody) return;
    seancesTableBody.innerHTML = '';
    const clientSearchTerm = searchSeanceClientInput ? searchSeanceClientInput.value.toLowerCase() : "";
    const statutFilter = filterSeanceStatut ? filterSeanceStatut.value : "";
    const dateStartFilter = filterSeanceDateStart ? filterSeanceDateStart.value : "";
    const dateEndFilter = filterSeanceDateEnd ? filterSeanceDateEnd.value : "";

    const filteredSeances = seances.filter(seance => {
        const client = clients.find(c => c.id === seance.id_client);
        const clientName = client ? `${client.prenom} ${client.nom}`.toLowerCase() : '';

        const matchesClient = !clientSearchTerm || clientName.includes(clientSearchTerm);
        const matchesStatut = !statutFilter || seance.statut_seance === statutFilter;

        let matchesDate = true;
        if (seance.date_heure_seance) {
            const seanceDateOnly = seance.date_heure_seance.split('T')[0];
            if (dateStartFilter && seanceDateOnly < dateStartFilter) matchesDate = false;
            if (dateEndFilter && seanceDateOnly > dateEndFilter) matchesDate = false;
        } else { // Si pas de date de séance, ne pas filtrer par date
            if(dateStartFilter || dateEndFilter) matchesDate = false; // ou true, selon la logique souhaitée
        }
        return matchesClient && matchesStatut && matchesDate;
    }).sort((a, b) => new Date(b.date_heure_seance) - new Date(a.date_heure_seance)); // Trier par date décroissante


    if (filteredSeances.length === 0) {
        seancesTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Aucune séance trouvée.</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0); 

    filteredSeances.forEach(seance => {
        const row = seancesTableBody.insertRow();
        row.dataset.seanceId = seance.id_seance;

        row.insertCell().textContent = seance.date_heure_seance ? new Date(seance.date_heure_seance).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-';
        const client = clients.find(c => c.id === seance.id_client);
        row.insertCell().textContent = client ? `${client.prenom} ${client.nom}` : 'Client inconnu';
        const tarif = tarifs.find(t => t.id === seance.id_tarif);
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

        const seanceDate = new Date(seance.date_heure_seance);
        const isFutureSeance = new Date(seance.date_heure_seance) > new Date();


        if (isFutureSeance) {
            if (seance.devis_number) {
                const devisLink = document.createElement('a');
                devisLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.devis_number}`;
                devisLink.textContent = seance.devis_number;
                devisLink.target = '_blank';
                devisLink.style.marginRight = '5px';
                invoiceCell.appendChild(devisLink);

                const emailDevisBtn = document.createElement('button');
                emailDevisBtn.innerHTML = '<img src="sendEmail.png" alt="Envoyer devis" style="height: 1.3em; vertical-align: middle;">';
                emailDevisBtn.classList.add('btn', 'btn-info', 'btn-sm');
                emailDevisBtn.title = 'Envoyer le devis par email';
                emailDevisBtn.style.padding = '0.1rem 0.2rem';
                emailDevisBtn.onclick = (e) => {
                    e.stopPropagation();
                    sendDevisByEmail(seance.id_seance, seance.devis_number, client ? client.email : null);
                };
                invoiceCell.appendChild(emailDevisBtn);
            } else if (!seance.invoice_number) { 
                const btnGenererDevis = document.createElement('button');
                btnGenererDevis.textContent = 'Devis';
                btnGenererDevis.classList.add('btn', 'btn-primary', 'btn-sm');
                btnGenererDevis.onclick = (e) => {
                    e.stopPropagation();
                    generateDevisForSeance(seance.id_seance);
                };
                invoiceCell.appendChild(btnGenererDevis);
            } else { 
                 const invoiceLink = document.createElement('a');
                 invoiceLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.invoice_number}`;
                 invoiceLink.textContent = seance.invoice_number;
                 invoiceLink.target = '_blank';
                 invoiceLink.style.marginRight = '5px';
                 invoiceCell.appendChild(invoiceLink);
            }
        } else { 
            if (seance.invoice_number) {
                const invoiceLink = document.createElement('a');
                invoiceLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.invoice_number}`;
                invoiceLink.textContent = seance.invoice_number;
                invoiceLink.target = '_blank';
                invoiceLink.style.marginRight = '5px';
                invoiceCell.appendChild(invoiceLink);

                const emailBtn = document.createElement('button');
                emailBtn.innerHTML = '<img src="sendEmail.png" alt="Envoyer facture" style="height: 1.3em; vertical-align: middle;">';
                emailBtn.classList.add('btn', 'btn-info', 'btn-sm');
                emailBtn.title = 'Envoyer la facture par email';
                emailBtn.style.padding = '0.1rem 0.2rem';
                emailBtn.onclick = (e) => {
                    e.stopPropagation();
                    sendInvoiceByEmail(seance.id_seance, seance.invoice_number, client ? client.email : null);
                };
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
                btnFacturer.onclick = (e) => {
                    e.stopPropagation();
                    generateInvoiceForSeance(seance.id_seance);
                };
                invoiceCell.appendChild(btnFacturer);
            }
        }

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions-cell');
        if (!seance.invoice_number) { // On ne peut modifier/supprimer que si non facturé
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Modifier';
            editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
            editBtn.style.marginRight = '5px';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                loadSeanceForEdit(seance.id_seance);
            };
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Supprimer';
            deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                openDeleteModal(seance.id_seance, 'seance', `Séance du ${new Date(seance.date_heure_seance).toLocaleDateString()}`);
            };
            actionsCell.appendChild(deleteBtn);
        } else {
            actionsCell.textContent = '-'; // Pas d'actions si facturé
        }

        row.addEventListener('dblclick', handleSeanceRowDblClick);
    });
}

async function generateInvoiceForSeance(seanceId) {
    if (currentlyEditingRow && currentlyEditingRow.dataset.seanceId === seanceId) {
        const currentSeance = seances.find(s => s.id_seance === seanceId);
        if (currentSeance) await saveRowChanges(currentlyEditingRow, currentSeance);
    }
    showToast('Génération de la facture en cours...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/seances/${seanceId}/generate-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Échec de la génération de la facture');
        }
        showToast(`Facture ${result.invoiceNumber} générée.`, 'success');

        const seanceIndex = seances.findIndex(s => s.id_seance === seanceId);
        if (seanceIndex > -1) {
            seances[seanceIndex].invoice_number = result.invoiceNumber;
            seances[seanceIndex].devis_number = null; 
            if (result.newSeanceStatus) {
                seances[seanceIndex].statut_seance = result.newSeanceStatus;
            }
        }
        renderSeancesTable(); // Re-render pour afficher le numéro de facture et màj actions
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
        console.error('Erreur génération facture:', error);
    }
}

async function generateDevisForSeance(seanceId) {
    if (currentlyEditingRow && currentlyEditingRow.dataset.seanceId === seanceId) {
        const seance = seances.find(s => s.id_seance === seanceId);
       if (seance) await saveRowChanges(currentlyEditingRow, seance);
    }
    showToast('Génération du devis en cours...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/seances/${seanceId}/generate-devis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Échec de la génération du devis');
        }
        showToast(`Devis ${result.devisNumber} généré.`, 'success');

        const seanceIndex = seances.findIndex(s => s.id_seance === seanceId);
        if (seanceIndex > -1) {
            seances[seanceIndex].devis_number = result.devisNumber;
        }
        renderSeancesTable(); // Re-render pour afficher le numéro de devis
    } catch (error) {
        showToast(`Erreur génération devis: ${error.message}`, 'error');
        console.error('Erreur génération devis:', error);
    }
}

async function sendInvoiceByEmail(seanceId, invoiceNumber, clientEmail) {
    if (currentlyEditingRow && currentlyEditingRow.dataset.seanceId === seanceId) {
        const currentSeance = seances.find(s => s.id_seance === seanceId);
        if (currentSeance) await saveRowChanges(currentlyEditingRow, currentSeance);
    }

    if (!appSettings || !appSettings.manager || !appSettings.manager.email) {
        showToast("L'email du manager n'est pas configuré dans les paramètres.", "error");
        return;
    }
    // La vérification GMAIL_APP_PASSWORD se fait côté serveur maintenant

    if (!clientEmail) {
        const clientForSeance = clients.find(c => c.id === seances.find(s => s.id_seance === seanceId)?.id_client);
        let clientNameInfo = clientForSeance ? `${clientForSeance.prenom} ${clientForSeance.nom}` : "ce client";
        showToast(`L'email pour ${clientNameInfo} n'est pas disponible. Veuillez l'ajouter à sa fiche.`, "error");
        return;
    }

    showToast(`Envoi de l'email pour la facture ${invoiceNumber}...`, 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/invoice/${invoiceNumber}/send-by-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientEmail: clientEmail }) // Le serveur utilisera GMAIL_USER/PASS des settings
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `Erreur serveur (${response.status}) lors de l'envoi de l'email.`);
        }

        showToast(result.message || `Facture ${invoiceNumber} envoyée avec succès à ${clientEmail}.`, 'success');

    } catch (error) {
        showToast(`Erreur lors de l'envoi de l'email: ${error.message}`, 'error');
        console.error("Erreur lors de l'envoi de l'email via le serveur:", error);
    }
}

async function sendDevisByEmail(seanceId, devisNumber, clientEmail) {
    if (currentlyEditingRow && currentlyEditingRow.dataset.seanceId === seanceId) {
        const seance = seances.find(s => s.id_seance === seanceId);
       if (seance) await saveRowChanges(currentlyEditingRow, seance);
    }

    if (!appSettings || !appSettings.manager || !appSettings.manager.email) {
        showToast("L'email du manager n'est pas configuré dans les paramètres.", "error"); return;
    }
    if (!clientEmail) {
        const clientForSeance = clients.find(c => c.id === seances.find(s => s.id_seance === seanceId)?.id_client);
        showToast(`L'email pour ${clientForSeance ? clientForSeance.prenom + ' ' + clientForSeance.nom : 'ce client'} n'est pas disponible.`, "error");
        return;
    }

    showToast(`Envoi de l'email pour le devis ${devisNumber}...`, 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/devis/${devisNumber}/send-by-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientEmail: clientEmail })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `Erreur serveur (${response.status}) lors de l'envoi de l'email du devis.`);
        }
        showToast(result.message || `Devis ${devisNumber} envoyé avec succès à ${clientEmail}.`, 'success');
    } catch (error) {
        showToast(`Erreur envoi email devis: ${error.message}`, 'error');
        console.error("Erreur envoi email devis:", error);
    }
}

if (searchSeanceClientInput) searchSeanceClientInput.addEventListener('input', renderSeancesTable);
if (filterSeanceStatut) filterSeanceStatut.addEventListener('change', renderSeancesTable);
if (filterSeanceDateStart) filterSeanceDateStart.addEventListener('input', renderSeancesTable);
if (filterSeanceDateEnd) filterSeanceDateEnd.addEventListener('input', renderSeancesTable);

if (clearSeanceFiltersBtn) clearSeanceFiltersBtn.addEventListener('click', () => {
    if(searchSeanceClientInput) searchSeanceClientInput.value = '';
    if(filterSeanceStatut) filterSeanceStatut.value = '';
    if(filterSeanceDateStart) filterSeanceDateStart.value = '';
    if(filterSeanceDateEnd) filterSeanceDateEnd.value = '';
    renderSeancesTable();
});

async function handleSeanceRowDblClick(event) {
    const row = event.currentTarget;
    const seanceId = row.dataset.seanceId;

    if (!seanceId) return;

    const seance = seances.find(s => s.id_seance === seanceId);
    if (!seance || seance.invoice_number) { // Ne pas permettre l'édition en ligne si facturé
        if (seance && seance.invoice_number) {
            showToast("Modification en ligne impossible pour une séance facturée.", "warning");
        }
        return;
    }


    if (currentlyEditingRow && currentlyEditingRow !== row) {
        const oldSeanceId = currentlyEditingRow.dataset.seanceId;
        const oldSeance = seances.find(s => s.id_seance === oldSeanceId);
        if (oldSeance) {
            await saveRowChanges(currentlyEditingRow, oldSeance);
        } else {
             revertRowToDisplayMode(currentlyEditingRow, null);
        }
    }

    if (currentlyEditingRow === row) return; // Déjà en mode édition

    currentlyEditingRow = row;
    
    const statusCell = row.querySelector('td[data-column="statut_seance"]');
    if (statusCell) {
        makeCellEditable(statusCell, seance, 'statut_seance');
    }

    const statutSelectElement = statusCell ? statusCell.querySelector('select') : null;
    const currentStatusInEdit = statutSelectElement ? statutSelectElement.value : seance.statut_seance;
    togglePaymentFieldsInRow(row, seance, currentStatusInEdit);
}

function makeCellEditable(cell, seance, columnName) {
    if (!cell || (cell.querySelector('input') || cell.querySelector('select'))) {
        return; // Déjà éditable ou pas de cellule
    }

    const originalValue = seance[columnName];
    cell.innerHTML = ''; // Vider la cellule

    let inputElement;

    if (columnName === 'statut_seance') {
        inputElement = document.createElement('select');
        inputElement.classList.add('form-input-sm');
        const statuses = { "PLANIFIEE": "Planifiée", "APAYER": "À Payer", "PAYEE": "Payée", "ANNULEE": "Annulée" };
        for (const key in statuses) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = statuses[key];
            if (key === originalValue) option.selected = true;
            inputElement.appendChild(option);
        }
        inputElement.addEventListener('change', () => {
            togglePaymentFieldsInRow(cell.parentElement, seance, inputElement.value);
        });

    } else if (columnName === 'mode_paiement') {
        inputElement = document.createElement('select');
        inputElement.classList.add('form-input-sm');
        const modes = { "": "Non spécifié", "ESPECE": "Espèce", "CHEQUE": "Chèque", "CARTE": "Carte Bancaire", "VIREMENT": "Virement" };
        for (const key in modes) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = modes[key];
            if (key === (originalValue || "")) option.selected = true;
            inputElement.appendChild(option);
        }
    } else if (columnName === 'date_paiement') {
        inputElement = document.createElement('input');
        inputElement.type = 'date';
        inputElement.classList.add('form-input-sm');
        inputElement.value = originalValue ? (originalValue.includes('T') ? originalValue.split('T')[0] : originalValue) : '';
    } else {
        return; // Type de colonne non géré pour l'édition en ligne
    }

    if (inputElement) {
        inputElement.style.width = '100%';
        cell.appendChild(inputElement);
        inputElement.focus();

        inputElement.addEventListener('blur', async (e) => {
            // Permettre le focus sur un autre input/select de la même ligne sans sauvegarder immédiatement
            const relatedTarget = e.relatedTarget;
            const currentRow = cell.closest('tr');
            if (relatedTarget && currentRow && currentRow.contains(relatedTarget) &&
                (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'SELECT')) {
                return; 
            }
            await saveRowChanges(cell.parentElement, seance);
        });
        inputElement.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await saveRowChanges(cell.parentElement, seance);
            } else if (e.key === 'Escape') {
                revertRowToDisplayMode(cell.parentElement, seance);
                currentlyEditingRow = null;
            }
        });
    }
}

function togglePaymentFieldsInRow(row, seance, currentStatut) {
    const modePaiementCell = row.querySelector('td[data-column="mode_paiement"]');
    const datePaiementCell = row.querySelector('td[data-column="date_paiement"]');

    if (!modePaiementCell || !datePaiementCell) return;

    if (currentStatut === 'PAYEE') {
        if (!modePaiementCell.querySelector('select')) { // Si pas déjà un select
            makeCellEditable(modePaiementCell, seance, 'mode_paiement');
        }
        if (!datePaiementCell.querySelector('input[type="date"]')) { // Si pas déjà un input date
            let seanceForDateEdit = {...seance}; // Copie pour ne pas altérer l'original avant sauvegarde
            if (!seanceForDateEdit.date_paiement) { // Mettre date du jour si vide
                seanceForDateEdit.date_paiement = new Date().toISOString().split('T')[0];
            }
            makeCellEditable(datePaiementCell, seanceForDateEdit, 'date_paiement');
        }
    } else { // Pour les autres statuts, remettre en mode affichage si c'était des inputs
        if (modePaiementCell.querySelector('select')) modePaiementCell.innerHTML = seance.mode_paiement || '-';
        if (datePaiementCell.querySelector('input[type="date"]')) datePaiementCell.innerHTML = seance.date_paiement ? new Date(seance.date_paiement).toLocaleDateString('fr-FR') : '-';
    }
}

async function saveRowChanges(row, seanceRef) { // seanceRef est la séance avant modif
    if (!row || !row.dataset || !row.dataset.seanceId || !seanceRef) {
        if (row) revertRowToDisplayMode(row, seanceRef); // Tenter de restaurer avec la réf si possible
        currentlyEditingRow = null;
        return;
    }

    const seanceId = row.dataset.seanceId;
    let seanceToUpdate = { ...seances.find(s => s.id_seance === seanceId) }; // Copie de la séance actuelle dans l'état global

    if (!seanceToUpdate) {
        showToast("Erreur: Séance non trouvée pour la mise à jour.", "error");
        revertRowToDisplayMode(row, null); // Restaurer avec null car la séance est introuvable
        currentlyEditingRow = null;
        return;
    }
    
    const oldStatus = seanceRef.statut_seance; // Statut avant modification

    let hasChanges = false;
    const statutSelectElement = row.querySelector('td[data-column="statut_seance"] select');
    if (statutSelectElement && seanceToUpdate.statut_seance !== statutSelectElement.value) {
        seanceToUpdate.statut_seance = statutSelectElement.value;
        hasChanges = true;
    }

    const modePaiementSelectElement = row.querySelector('td[data-column="mode_paiement"] select');
    const datePaiementInputElement = row.querySelector('td[data-column="date_paiement"] input[type="date"]');

    if (seanceToUpdate.statut_seance === 'PAYEE') {
        const newModePaiement = modePaiementSelectElement ? (modePaiementSelectElement.value || null) : seanceToUpdate.mode_paiement;
        if (seanceToUpdate.mode_paiement !== newModePaiement) {
            seanceToUpdate.mode_paiement = newModePaiement;
            hasChanges = true;
        }

        const newDatePaiement = datePaiementInputElement ? (datePaiementInputElement.value || null) : seanceToUpdate.date_paiement;
        // Normaliser l'ancienne date pour comparaison (si elle vient du TSV, elle peut être YYYY-MM-DD)
        const oldDatePaiementNormalized = seanceToUpdate.date_paiement ? (seanceToUpdate.date_paiement.includes('T') ? seanceToUpdate.date_paiement.split('T')[0] : seanceToUpdate.date_paiement) : null;

        if (oldDatePaiementNormalized !== newDatePaiement) {
            seanceToUpdate.date_paiement = newDatePaiement;
            hasChanges = true;
        }
    } else { // Si le statut n'est pas PAYEE, s'assurer que les champs de paiement sont null
        if (seanceToUpdate.mode_paiement !== null) {
            seanceToUpdate.mode_paiement = null; hasChanges = true;
        }
        if (seanceToUpdate.date_paiement !== null) {
            seanceToUpdate.date_paiement = null; hasChanges = true;
        }
    }

    if (!hasChanges) {
        revertRowToDisplayMode(row, seanceToUpdate); // Restaurer avec la version potentiellement modifiée (si un champ a été touché puis remis à l'identique)
        currentlyEditingRow = null;
        return;
    }
    
    seanceToUpdate.previous_statut_seance = oldStatus; // Ajout pour le serveur

    try {
        const response = await fetch(`${API_BASE_URL}/seances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seanceToUpdate)
        });
        const result = await response.json(); // Toujours attendre la réponse JSON
        if (!response.ok) {
            throw new Error(result.message || 'Échec de la mise à jour de la séance');
        }
        showToast(result.message || 'Séance mise à jour avec succès.');
        
        // Mettre à jour l'état local avec la version du serveur (qui peut inclure googleCalendarEventId etc.)
        const updatedSeanceFromServer = result.updatedSeance || seanceToUpdate; // Utiliser la séance retournée par le serveur si disponible
        const index = seances.findIndex(s => s.id_seance === seanceId);
        if (index > -1) {
            seances[index] = { ...seances[index], ...updatedSeanceFromServer }; // Fusionner avec les données du serveur
        }
        revertRowToDisplayMode(row, seances[index]); // Re-render la ligne avec les données à jour
    } catch (error) {
        showToast(`Erreur MAJ séance: ${error.message}`, 'error');
        console.error('Erreur de mise à jour de la séance :', error);
        // En cas d'erreur, restaurer avec la version avant modif (seanceRef)
        revertRowToDisplayMode(row, seanceRef); 
    } finally {
        currentlyEditingRow = null;
    }
}

function revertRowToDisplayMode(row, seance) {
    if (!row) return;
    const seanceId = row.dataset.seanceId;

    // Si seance n'est pas fourni, essayer de le retrouver dans l'état global
    if (!seance && seanceId) {
        seance = seances.find(s => s.id_seance === seanceId);
    }
    // Si toujours pas de seance (ex: suppression en cours ou erreur), mettre des tirets
    if (!seance) {
         row.querySelectorAll('td[data-column]').forEach(cell => {
            if (cell.firstChild && (cell.firstChild.tagName === 'INPUT' || cell.firstChild.tagName === 'SELECT')) {
                cell.innerHTML = '-'; // Mettre un tiret si la cellule était en édition
            }
         });
        return;
    }

    // Restaurer la cellule de statut
    const statutCell = row.querySelector('td[data-column="statut_seance"]');
    if (statutCell) {
        let statutText = seance.statut_seance;
        if(seance.statut_seance === 'APAYER') statutText = 'À Payer';
        else if(seance.statut_seance === 'PAYEE') statutText = 'Payée';
        else if(seance.statut_seance === 'ANNULEE') statutText = 'Annulée';
        else if(seance.statut_seance === 'PLANIFIEE') statutText = 'Planifiée';
        statutCell.innerHTML = statutText;
    }

    // Restaurer la cellule de mode de paiement
    const modePaiementCell = row.querySelector('td[data-column="mode_paiement"]');
    if (modePaiementCell) {
        modePaiementCell.innerHTML = seance.mode_paiement || '-';
    }

    // Restaurer la cellule de date de paiement
    const datePaiementCell = row.querySelector('td[data-column="date_paiement"]');
    if (datePaiementCell) {
        datePaiementCell.innerHTML = seance.date_paiement ? new Date(seance.date_paiement).toLocaleDateString('fr-FR') : '-';
    }

    // Re-render invoice/devis cell et actions cell car elles peuvent changer avec le statut
    const invoiceCell = row.querySelector('.invoice-cell');
    const actionsCell = row.querySelector('.actions-cell');
    if (invoiceCell && seance) { // S'assurer que seance est défini
        invoiceCell.innerHTML = ''; // Clear current content
        if (actionsCell) actionsCell.innerHTML = ''; // Clear current actions

        const today = new Date(); today.setHours(0,0,0,0);
        const seanceDate = new Date(seance.date_heure_seance);
        const isFutureSeance = new Date(seance.date_heure_seance) > new Date();
        const client = clients.find(c => c.id === seance.id_client);

        // Logique d'affichage facture/devis (identique à renderSeancesTable)
        if (isFutureSeance) {
            if (seance.devis_number) {
                const devisLink = document.createElement('a');
                devisLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.devis_number}`;
                devisLink.textContent = seance.devis_number;
                devisLink.target = '_blank';
                devisLink.style.marginRight = '5px';
                invoiceCell.appendChild(devisLink);

                const emailDevisBtn = document.createElement('button');
                emailDevisBtn.innerHTML = '<img src="sendEmail.png" alt="Envoyer devis" style="height: 1.3em; vertical-align: middle;">';
                emailDevisBtn.classList.add('btn', 'btn-info', 'btn-sm');
                emailDevisBtn.title = 'Envoyer le devis par email';
                emailDevisBtn.style.padding = '0.1rem 0.2rem';
                emailDevisBtn.onclick = (e) => { e.stopPropagation(); sendDevisByEmail(seance.id_seance, seance.devis_number, client ? client.email : null);};
                invoiceCell.appendChild(emailDevisBtn);
            } else if (!seance.invoice_number) {
                const btnGenererDevis = document.createElement('button');
                btnGenererDevis.textContent = 'Devis';
                btnGenererDevis.classList.add('btn', 'btn-primary', 'btn-sm');
                btnGenererDevis.onclick = (e) => { e.stopPropagation(); generateDevisForSeance(seance.id_seance); };
                invoiceCell.appendChild(btnGenererDevis);
            } else { 
                 const invoiceLink = document.createElement('a');
                 invoiceLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.invoice_number}`;
                 invoiceLink.textContent = seance.invoice_number;
                 invoiceLink.target = '_blank';
                 invoiceLink.style.marginRight = '5px';
                 invoiceCell.appendChild(invoiceLink);
            }
        } else { 
            if (seance.invoice_number) {
                const invoiceLink = document.createElement('a');
                invoiceLink.href = `${INVOICE_PREVIEW_BASE_URL}/invoice.html?invoiceNumber=${seance.invoice_number}`;
                invoiceLink.textContent = seance.invoice_number;
                invoiceLink.target = '_blank';
                invoiceLink.style.marginRight = '5px';
                invoiceCell.appendChild(invoiceLink);

                const emailBtn = document.createElement('button');
                emailBtn.innerHTML = '<img src="sendEmail.png" alt="Envoyer facture" style="height: 1.3em; vertical-align: middle;">';
                emailBtn.classList.add('btn', 'btn-info', 'btn-sm');
                emailBtn.title = 'Envoyer la facture par email';
                emailBtn.style.padding = '0.1rem 0.2rem';
                emailBtn.onclick = (e) => { e.stopPropagation(); sendInvoiceByEmail(seance.id_seance, seance.invoice_number, client ? client.email : null);};
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
                btnFacturer.onclick = (e) => { e.stopPropagation(); generateInvoiceForSeance(seance.id_seance); };
                invoiceCell.appendChild(btnFacturer);
            }
        }
        // Re-populate actions cell
        if (actionsCell) {
            if (!seance.invoice_number) {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Modifier'; editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
                editBtn.style.marginRight = '5px';
                editBtn.onclick = (e) => { e.stopPropagation(); loadSeanceForEdit(seance.id_seance);};
                actionsCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Supprimer'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
                deleteBtn.onclick = (e) => { e.stopPropagation(); openDeleteModal(seance.id_seance, 'seance', `Séance du ${new Date(seance.date_heure_seance).toLocaleDateString()}`);};
                actionsCell.appendChild(deleteBtn);
            } else {
                actionsCell.textContent = '-';
            }
        }
    } else if (invoiceCell) { // Si seance non défini mais invoiceCell existe
        invoiceCell.innerHTML = '-';
        if (actionsCell) actionsCell.innerHTML = '-';
    }
}


document.addEventListener('click', async (event) => {
    if (currentlyEditingRow && !currentlyEditingRow.contains(event.target)) {
        let targetIsActionButtonInSameRow = false;
        // Vérifier si la cible est un bouton d'action (facturer, devis, email) DANS la même ligne
        if (event.target.closest('tr') === currentlyEditingRow && 
            (event.target.tagName === 'BUTTON' || (event.target.tagName === 'IMG' && event.target.closest('button')))) {
            targetIsActionButtonInSameRow = true;
        }

        if (!targetIsActionButtonInSameRow) {
            const seanceId = currentlyEditingRow.dataset.seanceId;
            const seance = seances.find(s => s.id_seance === seanceId);
            if (seance) {
                await saveRowChanges(currentlyEditingRow, seance); // Sauvegarder les changements
            } else {
                revertRowToDisplayMode(currentlyEditingRow, null); // Restaurer si la séance n'est pas trouvée
                currentlyEditingRow = null;
            }
        }
    }
});

function loadSeanceForEdit(seanceId) {
    const seance = seances.find(s => s.id_seance === seanceId);
    if (!seance) return;

    if (seance.invoice_number) {
        showToast("Cette séance est facturée. Seuls le statut et les informations de paiement peuvent être modifiés par double-clic dans le tableau.", "warning");
        return;
    }

    // Si une autre ligne est en cours d'édition, la sauvegarder d'abord
    if (currentlyEditingRow) {
        const currentSeanceId = currentlyEditingRow.dataset.seanceId;
        if (currentSeanceId !== seanceId) { // S'assurer que ce n'est pas la même ligne
            const currentSeance = seances.find(s => s.id_seance === currentSeanceId);
            if (currentSeance) saveRowChanges(currentlyEditingRow, currentSeance); // Sauvegarder l'ancienne ligne
        }
    }

    editingSeanceId = seanceId;
    document.getElementById('seanceId').value = seance.id_seance;

    const client = clients.find(c => c.id === seance.id_client);
    seanceClientNameInput.value = client ? `${client.prenom} ${client.nom}` : '';
    seanceClientIdInput.value = seance.id_client;

    document.getElementById('seanceDate').value = seance.date_heure_seance; // Format YYYY-MM-DDTHH:mm
    populateTarifDropdowns();
    seanceTarifSelect.value = seance.id_tarif;
    seanceMontantInput.value = parseFloat(seance.montant_facture).toFixed(2);
    seanceStatutSelect.value = seance.statut_seance;

    toggleSeancePaymentFields(seance.statut_seance);
    if (seance.statut_seance === 'PAYEE') {
        seanceModePaiementSelect.value = seance.mode_paiement || '';
        document.getElementById('seanceDatePaiement').value = seance.date_paiement ? (seance.date_paiement.includes('T') ? seance.date_paiement.split('T')[0] : seance.date_paiement) : '';
    }

    seanceFormTitle.textContent = 'Modifier la séance';
    seanceFormContainer.classList.remove('hidden');
}


// --- Statistiques du Tableau de Bord ---
function updateDashboardStats() {
    if(document.getElementById('statClientsCount')) document.getElementById('statClientsCount').textContent = clients.length;
    if(document.getElementById('statSeancesCount')) document.getElementById('statSeancesCount').textContent = seances.length;

    const seancesPayees = seances.filter(s => s.statut_seance === 'PAYEE');
    if(document.getElementById('statSeancesPayees')) document.getElementById('statSeancesPayees').textContent = seancesPayees.length;

    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();
    let caMoisEnCours = 0;
    let caMoisPrecedent = 0;
    let caAnneeEnCours = 0;
    let caAnneePrecedente = 0;

    seancesPayees.forEach(seance => {
        if (!seance.date_paiement) return;
        const date = new Date(seance.date_paiement);
        const mois = date.getMonth();
        const annee = date.getFullYear();
        const montant = typeof seance.montant_facture === 'string' ? parseFloat(seance.montant_facture) : parseFloat(seance.montant_facture || 0);
        if (isNaN(montant)) return;

        if (annee === anneeActuelle) {
            caAnneeEnCours += montant;
            if (mois === moisActuel) {
                caMoisEnCours += montant;
            }
        }
        else if (annee === anneeActuelle - 1) {
            caAnneePrecedente += montant;
        }

        // Calcul du mois précédent
        let prevMonthDate = new Date(now);
        prevMonthDate.setMonth(now.getMonth() - 1);
        if (annee === prevMonthDate.getFullYear() && mois === prevMonthDate.getMonth()) {
            caMoisPrecedent += montant;
        }
    });

    if(document.getElementById('caMoisEnCours')) document.getElementById('caMoisEnCours').textContent = caMoisEnCours.toFixed(2);
    if(document.getElementById('caMoisPrecedent')) document.getElementById('caMoisPrecedent').textContent = caMoisPrecedent.toFixed(2);
    if(document.getElementById('caAnneeEnCours')) document.getElementById('caAnneeEnCours').textContent = caAnneeEnCours.toFixed(2);
    if(document.getElementById('caAnneePrecedente')) document.getElementById('caAnneePrecedente').textContent = caAnneePrecedente.toFixed(2);

    const viewDashboard = document.getElementById('viewDashboard');
    if (viewDashboard && viewDashboard.classList.contains('active')) {
         displaySessionsTrendChart();
    }
}

// --- Fonctions pour le Graphique d'Évolution des Séances ---
function getPeriodStartDate(dateStr, periodType) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0); // Normaliser à minuit

    if (periodType === 'day') {
        return d;
    } else if (periodType === 'week') {
        const day = d.getDay(); // 0 (Dimanche) - 6 (Samedi)
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour Lundi
        return new Date(d.setDate(diff));
    } else if (periodType === 'month') {
        return new Date(d.getFullYear(), d.getMonth(), 1);
    } else if (periodType === 'quarter') {
        const quarter = Math.floor(d.getMonth() / 3);
        return new Date(d.getFullYear(), quarter * 3, 1);
    } else if (periodType === 'year') {
        return new Date(d.getFullYear(), 0, 1);
    }
    return d; // Par défaut, retourne la date normalisée
}

function formatPeriodForDisplay(date, periodType) {
    const d = new Date(date);
    if (periodType === 'day') return d3.timeFormat("%d/%m/%y")(d);
    if (periodType === 'week') return `S${d3.timeFormat("%W-%y")(d)}`; // Semaine de l'année
    if (periodType === 'month') return d3.timeFormat("%b %Y")(d); // ex: Jan 2023
    if (periodType === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (periodType === 'year') return d3.timeFormat("%Y")(d);
    return d.toLocaleDateString(); // Fallback
}

function prepareChartData(allSeances, periodType) {
    if (!allSeances || allSeances.length === 0) {
        return [];
    }
    const aggregatedData = {};
    allSeances.forEach(seance => {
        const montantFacture = parseFloat(seance.montant_facture || 0);
        // Agréger par date de séance pour les statuts
        if (seance.date_heure_seance) {
            const sessionDate = new Date(seance.date_heure_seance);
            if (!isNaN(sessionDate.getTime())) {
                const sessionPeriodStart = getPeriodStartDate(sessionDate, periodType);
                if (sessionPeriodStart) {
                    const sessionPeriodKey = sessionPeriodStart.toISOString().slice(0, 10); // Clé unique pour la période
                    if (!aggregatedData[sessionPeriodKey]) {
                        aggregatedData[sessionPeriodKey] = {
                            periodDate: sessionPeriodStart,
                            periodLabel: formatPeriodForDisplay(sessionPeriodStart, periodType),
                            cancelledSessions: 0, paidSessions: 0, toPaySessions: 0, plannedSessions: 0, paidAmount: 0
                        };
                    }
                    if (seance.statut_seance === 'ANNULEE') aggregatedData[sessionPeriodKey].cancelledSessions += 1;
                    else if (seance.statut_seance === 'PAYEE') aggregatedData[sessionPeriodKey].paidSessions += 1;
                    else if (seance.statut_seance === 'APAYER') aggregatedData[sessionPeriodKey].toPaySessions += 1;
                    else if (seance.statut_seance === 'PLANIFIEE') aggregatedData[sessionPeriodKey].plannedSessions += 1;
                }
            }
        }
        // Agréger par date de paiement pour le montant payé
        if (seance.statut_seance === 'PAYEE' && seance.date_paiement) {
            const paymentDate = new Date(seance.date_paiement);
             if (!isNaN(paymentDate.getTime())) {
                const paymentPeriodStart = getPeriodStartDate(paymentDate, periodType);
                if (paymentPeriodStart) {
                    const paymentPeriodKey = paymentPeriodStart.toISOString().slice(0, 10);
                    if (!aggregatedData[paymentPeriodKey]) { // S'assurer que la période existe
                        aggregatedData[paymentPeriodKey] = {
                            periodDate: paymentPeriodStart, periodLabel: formatPeriodForDisplay(paymentPeriodStart, periodType),
                            cancelledSessions: 0, paidSessions: 0, toPaySessions: 0, plannedSessions: 0, paidAmount: 0
                        };
                    }
                    if (!isNaN(montantFacture)) aggregatedData[paymentPeriodKey].paidAmount += montantFacture;
                }
            }
        }
    });
    return Object.values(aggregatedData).sort((a, b) => a.periodDate - b.periodDate);
}


function renderSessionsTrendChart(chartData) {
    if(!sessionsTrendChartContainer) return;
    sessionsTrendChartContainer.innerHTML = ''; // Vider le conteneur
    if (!chartData || chartData.length === 0) {
        sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Pas de données suffisantes pour afficher le graphique.</p>";
        return;
    }
    const containerWidth = sessionsTrendChartContainer.clientWidth;
     if (containerWidth === 0) { // Si le conteneur n'est pas encore visible/dimensionné
        setTimeout(() => renderSessionsTrendChart(chartData), 100); // Réessayer un peu plus tard
        return;
    }
    const margin = {top: 30, right: 70, bottom: 110, left: 60}, // Augmenter bottom pour les labels x rotatés
          width = Math.max(0, containerWidth - margin.left - margin.right),
          height = Math.max(0, 400 - margin.top - margin.bottom); // Hauteur fixe pour le graphique
    if (width <= 0 || height <= 0) {
        sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Espace insuffisant pour afficher le graphique.</p>";
        return;
    }
    const svg = d3.select(sessionsTrendChartContainer).append("svg")
        .attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom)
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const periods = chartData.map(d => d.periodLabel);
    const x = d3.scaleBand().domain(periods).range([0, width]).padding(0.2);
    // Calculer le max pour l'axe Y des comptes (barres empilées)
    const yCountsMax = d3.max(chartData, d => d.cancelledSessions + d.paidSessions + d.toPaySessions + d.plannedSessions) || 1;
    const yCounts = d3.scaleLinear().domain([0, yCountsMax]).nice().range([height, 0]);
    // Calculer le max pour l'axe Y des montants (ligne)
    const yAmountsMax = d3.max(chartData, d => d.paidAmount) || 1; // Assurer au moins 1 pour éviter domaine [0,0]
    const yAmounts = d3.scaleLinear().domain([0, yAmountsMax]).nice().range([height, 0]);
    // Axe X
    const xAxis = d3.axisBottom(x);
    svg.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${height})`).call(xAxis)
        .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)");
    // Axe Y gauche (Comptes)
    svg.append("g").attr("class", "axis axis--y-counts").call(d3.axisLeft(yCounts))
      .append("text").attr("fill", "#000").attr("transform", "rotate(-90)").attr("y", -margin.left + 15)
        .attr("x", -height/2).attr("dy", "0.71em").attr("text-anchor", "middle").text("Nombre de Séances");
    // Axe Y droit (Montants)
    svg.append("g").attr("class", "axis axis--y-amounts").attr("transform", `translate(${width},0)`).call(d3.axisRight(yAmounts))
      .append("text").attr("fill", "#000").attr("transform", "rotate(-90)").attr("y", margin.right - 25) // Ajuster position label
        .attr("x", -height/2).attr("dy", "-0.71em").attr("text-anchor", "middle").text("Montant Payé (€)");
    // Barres empilées pour les statuts de séances
    const stackKeys = ['plannedSessions', 'toPaySessions', 'paidSessions', 'cancelledSessions']; // Ordre d'empilement
    const stack = d3.stack().keys(stackKeys);
    const stackedData = stack(chartData);
    const colorScale = d3.scaleOrdinal().domain(stackKeys).range(['#17a2b8', '#ffc107', '#28a745', '#dc3545']); // Couleurs pour Planifiée, À Payer, Payée, Annulée
    // Tooltip
    const tooltip = d3.select("body").append("div").attr("class", "chart-tooltip")
        .style("opacity", 0).style("position", "absolute").style("pointer-events", "none");
    // Groupes de barres
    const barGroups = svg.append("g").selectAll("g").data(stackedData).enter().append("g")
          .attr("fill", d => colorScale(d.key)).attr("class", d => `bar-stack-${d.key}`);
    barGroups.selectAll("rect").data(d => d).enter().append("rect")
          .attr("x", d => x(d.data.periodLabel)).attr("y", d => yCounts(d[1]))
          .attr("height", d => Math.max(0, yCounts(d[0]) - yCounts(d[1]))).attr("width", x.bandwidth())
          .on("mouseover", function(event, d) {
              const key = d3.select(this.parentNode).datum().key; // Récupérer la clé de la série (ex: 'paidSessions')
              let count; let label;
              if (key === 'cancelledSessions') { count = d.data.cancelledSessions; label = 'Annulées';}
              else if (key === 'paidSessions') { count = d.data.paidSessions; label = 'Payées';}
              else if (key === 'toPaySessions') { count = d.data.toPaySessions; label = 'À Payer';}
              else if (key === 'plannedSessions') { count = d.data.plannedSessions; label = 'Planifiées';}
              tooltip.transition().duration(200).style("opacity", .9);
              tooltip.html(`<strong>${d.data.periodLabel}</strong><br/>Séances ${label}: ${count}`)
                  .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
              // Estomper les autres barres
              svg.selectAll(".bar-stack-plannedSessions rect, .bar-stack-cancelledSessions rect, .bar-stack-paidSessions rect, .bar-stack-toPaySessions rect").style("opacity", 0.3);
              // Mettre en évidence la barre survolée
              svg.selectAll(`.bar-stack-${key} rect`).filter(barData => barData.data.periodLabel === d.data.periodLabel).style("opacity", 1);
          }).on("mouseout", function() {
              tooltip.transition().duration(500).style("opacity", 0);
              // Rétablir l'opacité de toutes les barres
              svg.selectAll(".bar-stack-plannedSessions rect, .bar-stack-cancelledSessions rect, .bar-stack-paidSessions rect, .bar-stack-toPaySessions rect").style("opacity", 1);
          });
    // Ligne pour le montant payé
    const linePaidAmount = d3.line().x(d => x(d.periodLabel) + x.bandwidth() / 2).y(d => yAmounts(d.paidAmount))
        .defined(d => d.paidAmount !== undefined && d.paidAmount !== null); // Ne pas tracer si undefined/null
    svg.append("path").datum(chartData.map(d => ({...d, paidAmount: d.paidAmount || 0}))) // Assurer que paidAmount est un nombre pour la ligne
        .attr("class", "line paid-amount-line").attr("fill", "none").attr("stroke", "#007bff") // Bleu pour la ligne
        .attr("stroke-width", 2.5).attr("d", linePaidAmount);
    // Points sur la ligne
    svg.selectAll(".dot-paid-amount").data(chartData.filter(d => d.paidAmount !== undefined && d.paidAmount !== null && d.paidAmount > 0)) // Points seulement si > 0
        .enter().append("circle").attr("class", "dot dot-paid-amount")
        .attr("cx", d => x(d.periodLabel) + x.bandwidth() / 2).attr("cy", d => yAmounts(d.paidAmount))
        .attr("r", 5).attr("fill", "#007bff").attr("stroke", "white").attr("stroke-width", 1.5)
        .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.periodLabel}</strong><br/>Montant Payé: ${d.paidAmount.toFixed(2)}€`)
                .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        }).on("mouseout", () => { tooltip.transition().duration(500).style("opacity", 0); });
    // Légende
    const legendData = [
        { color: '#17a2b8', text: "Planifiées" }, { color: '#ffc107', text: "À Payer" },
        { color: '#28a745', text: "Payées" }, { color: '#dc3545', text: "Annulées" },
        { color: "#007bff", text: "Montant Payé (€) (Ligne)" }
    ];
    const legendContainer = svg.append("g").attr("class", "legend-container")
        .attr("transform", `translate(0, ${height + margin.bottom - 45})`); // Ajuster position Y
    const legend = legendContainer.selectAll(".legend-item").data(legendData).enter().append("g")
        .attr("class", "legend-item").attr("transform", (d, i) => `translate(${i * 130}, 0)`); // Espacement
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 18).attr("height", 18).style("fill", d => d.color);
    legend.append("text").attr("x", 24).attr("y", 9).attr("dy", ".35em")
        .style("text-anchor", "start").style("font-size", "10px").text(d => d.text);
}


function displaySessionsTrendChart() {
    if (!seances) {
        if (sessionsTrendChartContainer) sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; color:#666;'>Données des séances non chargées.</p>";
        return;
    }
    const viewDashboard = document.getElementById('viewDashboard');
    if (!viewDashboard || !viewDashboard.classList.contains('active')) {
        return; // Ne pas rendre si l'onglet n'est pas actif
    }
    const periodType = chartPeriodSelector ? chartPeriodSelector.value : 'month';
    const chartData = prepareChartData(seances, periodType);
    renderSessionsTrendChart(chartData);
}

if (chartPeriodSelector) {
    chartPeriodSelector.addEventListener('change', displaySessionsTrendChart);
}

// --- Gestion de la Configuration ---
function populateConfigForm() {
    if (!appSettings || !configForm) return;
    if (appSettings.manager) {
        if(configManagerName) configManagerName.value = appSettings.manager.name || '';
        if(configManagerTitle) configManagerTitle.value = appSettings.manager.title || '';
        if(configManagerDescription) configManagerDescription.value = appSettings.manager.description || '';
        if(configManagerAddress) configManagerAddress.value = appSettings.manager.address || '';
        if(configManagerCity) configManagerCity.value = appSettings.manager.city || '';
        if(configManagerPhone) configManagerPhone.value = appSettings.manager.phone || '';
        if(configManagerEmail) configManagerEmail.value = appSettings.manager.email || ''; // GMAIL_USER
        // Ne pas pré-remplir le mot de passe d'application pour des raisons de sécurité
        if(configGmailAppPassword) configGmailAppPassword.value = ''; 
        if(gmailTestResultDiv) {
            gmailTestResultDiv.textContent = appSettings.manager.gmailAppPasswordStatus === 'success' ? 'Connexion Gmail précédemment réussie.' : '';
            gmailTestResultDiv.style.color = appSettings.manager.gmailAppPasswordStatus === 'success' ? 'green' : 'red';
        }
    }
    if(configTva) configTva.value = appSettings.tva !== undefined ? appSettings.tva : '';
    if (appSettings.legal) {
        if(configSiret) configSiret.value = appSettings.legal.siret || '';
        if(configApe) configApe.value = appSettings.legal.ape || '';
        if(configAdeli) configAdeli.value = appSettings.legal.adeli || '';
        if(configIban) configIban.value = appSettings.legal.iban || '';
        if(configBic) configBic.value = appSettings.legal.bic || '';
        if(configTvaMention) configTvaMention.value = appSettings.legal.tvaMention || '';
        if(configPaymentTerms) configPaymentTerms.value = appSettings.legal.paymentTerms || '';
        if(configInsurance) configInsurance.value = appSettings.legal.insurance || '';
    }
}

if (configForm) {
    configForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const managerEmail = configManagerEmail.value;
        const gmailPassword = configGmailAppPassword.value; // Récupérer le mot de passe entré

        let gmailTestPassed = appSettings.manager && appSettings.manager.gmailAppPasswordStatus === 'success'; // Par défaut, si déjà OK et pas de nouveau mdp

        if (managerEmail && gmailPassword) { // Si un nouveau mot de passe est fourni, tester
            gmailTestResultDiv.textContent = 'Test de la connexion Gmail en cours...';
            gmailTestResultDiv.style.color = 'orange';
            try {
                const testResponse = await fetch(`${API_BASE_URL}/settings/test-gmail`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: managerEmail, appPassword: gmailPassword })
                });
                const testResult = await testResponse.json();
                if (testResponse.ok && testResult.success) {
                    gmailTestResultDiv.textContent = 'Connexion Gmail réussie ! Le mot de passe sera utilisé mais non stocké ici.';
                    gmailTestResultDiv.style.color = 'green';
                    if (configGmailAppPassword) configGmailAppPassword.value = ''; // Vider le champ après succès
                    gmailTestPassed = true;
                } else {
                    gmailTestResultDiv.textContent = `Échec du test Gmail : ${testResult.message || 'Vérifiez les identifiants.'}`;
                    gmailTestResultDiv.style.color = 'red';
                    gmailTestPassed = false;
                }
            } catch (err) {
                gmailTestResultDiv.textContent = `Erreur lors du test Gmail : ${err.message}`;
                gmailTestResultDiv.style.color = 'red';
                gmailTestPassed = false;
            }
        } else if (managerEmail && !gmailPassword && !(appSettings.manager && appSettings.manager.gmailAppPasswordStatus === 'success')) {
            // Si l'email est là, mais pas de mdp et pas de succès précédent, indiquer que le mdp est nécessaire pour tester/activer
            gmailTestResultDiv.textContent = 'Mot de passe d\'application requis pour activer/tester la connexion Gmail.';
            gmailTestResultDiv.style.color = 'orange';
            gmailTestPassed = false; // Ne pas considérer comme succès si on n'a pas de mdp et pas de succès antérieur
        }


        const updatedSettings = {
            manager: {
                name: configManagerName.value, title: configManagerTitle.value, description: configManagerDescription.value,
                address: configManagerAddress.value, city: configManagerCity.value,
                phone: configManagerPhone.value, email: managerEmail, // GMAIL_USER
                // Le GMAIL_APP_PASSWORD est envoyé au backend uniquement s'il est fourni pour le test/la sauvegarde.
                // Le backend ne le stockera pas en clair mais l'utilisera pour configurer nodemailer.
                // On stocke juste le statut du test.
                gmailAppPassword: gmailPassword || undefined, // Envoyer si fourni, sinon undefined pour que le backend ne l'écrase pas s'il est déjà configuré
                gmailAppPasswordStatus: gmailTestPassed ? 'success' : (appSettings.manager && appSettings.manager.gmailAppPasswordStatus === 'success' && !gmailPassword ? 'success' : 'failed_or_not_set')
            },
            tva: parseFloat(configTva.value) || 0,
            legal: {
                siret: configSiret.value, ape: configApe.value, adeli: configAdeli.value,
                iban: configIban.value, bic: configBic.value, tvaMention: configTvaMention.value,
                paymentTerms: configPaymentTerms.value, insurance: configInsurance.value
            }
        };
        try {
            const response = await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings)
            });
            if (!response.ok) throw new Error('Échec de la sauvegarde des paramètres');
            const savedSettings = await response.json(); // Récupérer les paramètres sauvegardés (sans le mdp)
            appSettings = savedSettings; // Mettre à jour l'état global
            showToast('Paramètres enregistrés avec succès.');
            // Mettre à jour l'affichage du statut du mot de passe après la sauvegarde
             if(gmailTestResultDiv && appSettings.manager.gmailAppPasswordStatus === 'success' && !gmailPassword) {
                gmailTestResultDiv.textContent = 'Connexion Gmail précédemment réussie.';
                gmailTestResultDiv.style.color = 'green';
            } else if (gmailTestResultDiv && !gmailPassword && appSettings.manager.gmailAppPasswordStatus !== 'success') {
                 gmailTestResultDiv.textContent = ''; // Effacer si pas de mdp et pas de succès antérieur
            }


        } catch (error) {
            showToast(`Erreur sauvegarde paramètres: ${error.message}`, 'error');
            console.error('Erreur de sauvegarde des paramètres :', error);
        }
    });
}

// --- Initialisation ---
async function initializeApp() {
    await fetchSettings(); // Charger les settings en premier pour GMAIL_USER etc.
    await fetchTarifs();
    await fetchClients();
    await fetchSeances();

    const defaultView = 'viewSeances'; // Ou 'viewDashboard' ou ce que vous préférez
    switchView(defaultView);
    if (defaultView === 'viewDashboard' && document.getElementById('viewDashboard').classList.contains('active')) {
        displaySessionsTrendChart();
    }
}

initializeApp();
