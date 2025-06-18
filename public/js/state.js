// js/state.js
export let clients = [];
export let tarifs = [];
export let seances = [];
export let appSettings = {
    manager: { name: "", title: "", description: "", address: "", city: "", phone: "", email: "" },
    googleOAuth: { 
        isConnected: false, 
        userEmail: null, 
        userName: null, // Ajout
        profilePictureUrl: null, // Ajout
        scopes: [] 
    },
    tva: 0,
    legal: { siret: "", ape: "", adeli: "", iban: "", bic: "", tvaMention: "TVA non applicable - Art. 293B du CGI", paymentTerms: "Paiement à réception de facture", insurance: "" },
    googleCalendar: { calendarId: "primary" },
    dataContext: "demo"
};
export let currentlyEditingRow = null; // Pour l'édition en ligne des séances

export let editingClientId = null;
export let editingTarifId = null;
export let editingSeanceId = null;

export let itemToDelete = { id: null, type: null }; // Pour la modale de suppression

// Fonctions pour mettre à jour l'état (si nécessaire, pour plus de contrôle/réactivité)
export function setClients(data) {
    clients = data;
}
export function updateClientInState(updatedClient) {
    const index = clients.findIndex(c => c.id === updatedClient.id);
    if (index > -1) {
        clients[index] = updatedClient;
    } else {
        clients.push(updatedClient);
    }
}
export function removeClientFromState(clientId) {
    clients = clients.filter(c => c.id !== clientId);
}


export function setTarifs(data) {
    tarifs = data;
}
export function updateTarifInState(updatedTarif) {
    const index = tarifs.findIndex(t => t.id === updatedTarif.id);
    if (index > -1) {
        tarifs[index] = updatedTarif;
    } else {
        tarifs.push(updatedTarif);
    }
}
export function removeTarifFromState(tarifId) {
    tarifs = tarifs.filter(t => t.id !== tarifId);
}


export function setSeances(data) {
    seances = data;
}
export function updateSeanceInState(updatedSeance) {
    const index = seances.findIndex(s => s.id_seance === updatedSeance.id_seance);
    if (index > -1) {
        // Remplacer complètement l'objet existant
        seances[index] = updatedSeance;
    } else {
        seances.push(updatedSeance);
    }
}
export function removeSeanceFromState(seanceId) {
    seances = seances.filter(s => s.id_seance !== seanceId);
}


export function setAppSettings(data) {
    appSettings = data;
}

export function setCurrentlyEditingRow(row) {
    currentlyEditingRow = row;
}

export function setEditingClientId(id) {
    editingClientId = id;
}
export function setEditingTarifId(id) {
    editingTarifId = id;
}
export function setEditingSeanceId(id) {
    editingSeanceId = id;
}

export function setItemToDelete(id, type) {
    itemToDelete = { id, type };
}
export function clearItemToDelete() {
    itemToDelete = { id: null, type: null };
}