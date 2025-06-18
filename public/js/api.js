// js/api.js
import { showToast, getApiBaseUrl } from './utils.js';
import * as state from './state.js';
import { renderClientsTable } from './clients.js';
import { renderTarifsTable } from './tarifs.js';
import { renderSeancesTable } from './seances.js';
import { populateTarifDropdowns } from './uiHelpers.js'; // MODIFIÉ: Importer depuis uiHelpers.js
import { updateDashboardStats } from './dashboard.js';
// populateConfigForm n'est plus directement appelé par fetchSettings ici.

const API_BASE_URL = getApiBaseUrl();

export async function fetchClients() {
    try {
        const response = await fetch(`${API_BASE_URL}/clients`);
        if (!response.ok) throw new Error('Échec de la récupération des clients');
        const clientsData = await response.json();
        state.setClients(clientsData);
        renderClientsTable();
        populateTarifDropdowns(); 
        updateDashboardStats();
    } catch (error) {
        showToast(`Erreur chargement clients: ${error.message}`, 'error');
    }
}

export async function fetchTarifs() {
    try {
        const response = await fetch(`${API_BASE_URL}/tarifs`);
        if (!response.ok) throw new Error('Échec de la récupération des tarifs');
        const tarifsData = await response.json();
        state.setTarifs(tarifsData);
        renderTarifsTable();
        populateTarifDropdowns(); 
        if(state.clients.length > 0) renderClientsTable(); 
        updateDashboardStats();
    } catch (error) {
        showToast(`Erreur chargement tarifs: ${error.message}`, 'error');
    }
}

export async function fetchSeances() {
    try {
        const response = await fetch(`${API_BASE_URL}/seances`);
        if (!response.ok) throw new Error('Échec de la récupération des séances');
        const seancesData = await response.json();
        state.setSeances(seancesData);
        renderSeancesTable();
        updateDashboardStats();
    } catch (error) {
        showToast(`Erreur chargement séances: ${error.message}`, 'error');
    }
}

export async function fetchSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (!response.ok) throw new Error('Échec de la récupération des paramètres');
        const settingsData = await response.json();
        state.setAppSettings(settingsData);
    } catch (error) {
        showToast(`Erreur chargement paramètres: ${error.message}`, 'error');
        console.warn("Utilisation des paramètres par défaut car le fetch a échoué.");
    }
}

export async function saveClient(clientData) {
    const response = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la sauvegarde du client');
    }
    return response.json();
}

export async function saveTarif(tarifData) {
    const response = await fetch(`${API_BASE_URL}/tarifs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarifData)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la sauvegarde du tarif');
    }
    return response.json();
}

export async function saveSeance(seanceData) {
    const response = await fetch(`${API_BASE_URL}/seances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seanceData) 
    });
    const result = await response.json(); 
    if (!response.ok) throw new Error(result.message || 'Échec sauvegarde séance');
    return result;
}

export async function deleteItem(id, type) {
    let endpoint = '';
    if (type === 'client') endpoint = `${API_BASE_URL}/clients/${id}`;
    else if (type === 'tarif') endpoint = `${API_BASE_URL}/tarifs/${id}`;
    else if (type === 'seance') endpoint = `${API_BASE_URL}/seances/${id}`;
    else throw new Error('Type de suppression inconnu');

    const response = await fetch(endpoint, { method: 'DELETE' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur lors de la suppression.`);
    }
    // Certains backends DELETE peuvent ne pas renvoyer de JSON mais un statut 204 No Content.
    // Gérer cela en conséquence ou s'attendre à un JSON comme { success: true }.
    try {
        return await response.json(); 
    } catch (e) {
        if (response.status === 200 || response.status === 204) return { success: true, message: `${type} supprimé(e)`};
        throw e; // Relancer si ce n'est pas une réponse vide attendue
    }
}


export async function generateInvoiceForSeanceApi(seanceId) {
    const response = await fetch(`${API_BASE_URL}/seances/${seanceId}/generate-invoice`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Échec génération facture');
    return result;
}

export async function generateDevisForSeanceApi(seanceId) {
    const response = await fetch(`${API_BASE_URL}/seances/${seanceId}/generate-devis`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Échec génération devis');
    return result;
}

export async function sendInvoiceByEmailApi(invoiceNumber, clientEmail, documentData) {
    const response = await fetch(`${API_BASE_URL}/invoice/${invoiceNumber}/send-by-email`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ clientEmail, documentData }) // MODIFIÉ
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Erreur serveur (${response.status})`);
    return result;
}

export async function sendDevisByEmailApi(devisNumber, clientEmail, documentData) {
    const response = await fetch(`${API_BASE_URL}/devis/${devisNumber}/send-by-email`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ clientEmail, documentData }) // MODIFIÉ
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Erreur serveur (${response.status})`);
    return result;
}

export async function saveSettings(settingsData) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la sauvegarde des paramètres');
    }
    const result = await response.json();
    
    // S'assurer que les infos OAuth sont présentes dans la réponse
    if (!result.googleOAuth && state.appSettings.googleOAuth) {
        result.googleOAuth = state.appSettings.googleOAuth;
    }
    
    return result;
}

export async function disconnectGoogleAccount() {
    const response = await fetch(`${API_BASE_URL}/auth/google/disconnect`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Échec de la déconnexion du compte Google');
    }
    return result;
}

export async function updateSpreadsheet() {
    const response = await fetch('/api/spreadsheet/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la mise à jour du tableur');
    }

    return response.json();
}

export async function fetchCalendarAvailability() {
    // Vérifie si l'utilisateur est connecté à Google avant de faire l'appel
    // Vous pouvez récupérer `appSettings` depuis `state.js` si nécessaire
    // if (!state.appSettings.googleOAuth.isConnected) {
    //    console.log("Non connecté à Google, impossible de récupérer les disponibilités.");
    //    return []; // Retourne un tableau vide
    // }
    try {
        const response = await fetch(`${API_BASE_URL}/calendar/availability`);
        if (!response.ok) {
            throw new Error('Échec de la récupération des disponibilités du calendrier');
        }
        return await response.json();
    } catch (error) {
        showToast(`Erreur disponibilités: ${error.message}`, 'warning');
        console.error("Erreur fetchCalendarAvailability:", error);
        return []; // Retourne un tableau vide en cas d'erreur
    }
}
export async function exportToGoogleSheets() {
    const response = await fetch(`${API_BASE_URL}/export-to-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Échec de l\'export vers Google Sheets');
    return result;
}