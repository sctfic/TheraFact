// js/config.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast, getApiBaseUrl } from './utils.js';

const API_BASE_URL = getApiBaseUrl();

/**
 * Met à jour les informations de la barre supérieure (avatar, contexte de données).
 * @param {object} currentSettings - L'objet des paramètres de l'application.
 */
export function updateTopBarInfo(currentSettings = state.appSettings) {
    if (!currentSettings || !dom.userProfileContainer) return;

    const isConnected = currentSettings.googleOAuth && currentSettings.googleOAuth.isConnected;
    
    // On cible directement l'image à l'intérieur du SVG
    if (dom.svgInnerImage) {
        if (isConnected && currentSettings.googleOAuth.profilePictureUrl) {
            // État connecté : on affiche l'avatar de l'utilisateur
            dom.svgInnerImage.setAttribute('href', currentSettings.googleOAuth.profilePictureUrl);
            dom.userProfileContainer.title = "Compte Google - " + (currentSettings.googleOAuth.userName || currentSettings.googleOAuth.userEmail);
        } else {
            // État déconnecté : on affiche l'icône de déconnexion
            dom.svgInnerImage.setAttribute('href', 'pictures/google_disconnected.png');
            dom.userProfileContainer.title = "Connecter un compte Google";
        }
        dom.svgInnerImage.classList.toggle('brightness', !isConnected);
    }
    
    // Mettre à jour les infos dans le menu déroulant (si connecté)
    if (isConnected) {
        if (dom.dropdownUserName) dom.dropdownUserName.textContent = currentSettings.googleOAuth.userName || '';
        if (dom.dropdownUserEmail) dom.dropdownUserEmail.textContent = currentSettings.googleOAuth.userEmail || '';
    }

    if (dom.dataContextDisplay) {
        dom.dataContextDisplay.textContent = currentSettings.dataContext || 'demo';
    }
}


export function populateConfigForm(currentSettings = state.appSettings) {
    if (!currentSettings || !dom.configForm) return;

    // Mettre à jour les infos globales de la barre du haut
    updateTopBarInfo(currentSettings);
    
    if (currentSettings.manager) {
        if(dom.configManagerName) dom.configManagerName.value = currentSettings.manager.name || '';
        if(dom.configManagerTitle) dom.configManagerTitle.value = currentSettings.manager.title || '';
        if(dom.configManagerDescription) dom.configManagerDescription.value = currentSettings.manager.description || '';
        if(dom.configManagerAddress) dom.configManagerAddress.value = currentSettings.manager.address || '';
        if(dom.configManagerCity) dom.configManagerCity.value = currentSettings.manager.city || '';
        if(dom.configManagerPhone) dom.configManagerPhone.value = currentSettings.manager.phone || '';
        if(dom.configManagerEmailContact) dom.configManagerEmailContact.value = currentSettings.manager.email || ''; 
    }

    if (currentSettings.googleOAuth) {
        if (currentSettings.googleOAuth.isConnected && currentSettings.googleOAuth.userEmail) {
            dom.googleAuthStatusText.textContent = `Connecté en tant que : ${currentSettings.googleOAuth.userEmail}`;
            dom.googleAuthStatusText.style.color = 'green';
            dom.btnConnectGoogle.style.display = 'none';
            dom.btnDisconnectGoogle.style.display = 'inline-block';
            let scopesHtml = 'Permissions accordées :<ul>';
            (currentSettings.googleOAuth.scopes || []).forEach(scope => {
                let readableScope = scope;
                if (scope.includes('gmail.send')) readableScope = "Envoyer des emails";
                else if (scope.includes('calendar.events')) readableScope = "Gérer les événements du calendrier";
                else if (scope.includes('userinfo.email')) readableScope = "Voir votre adresse email";
                else if (scope.includes('userinfo.profile')) readableScope = "Voir vos informations de profil basiques (avatar)";
                else if (scope.includes('drive.file')) readableScope = "Gérer les fichiers créés ou ouverts avec cette application";
                else if (scope.includes('sheets')) readableScope = "Gérer vos feuilles de calcul Google Sheets";
                scopesHtml += `<li>${readableScope}</li>`;
            });
            scopesHtml += '</ul>';
            dom.googleAuthScopesDiv.innerHTML = scopesHtml;
        } else {
            dom.googleAuthStatusText.textContent = 'Non connecté à Google. Email & Calendrier limités.';
            dom.googleAuthStatusText.style.color = 'red';
            dom.btnConnectGoogle.style.display = 'inline-block';
            dom.btnDisconnectGoogle.style.display = 'none';
            dom.googleAuthScopesDiv.innerHTML = '';
        }
    } else { 
        dom.googleAuthStatusText.textContent = 'État de la connexion Google non déterminé.';
        dom.googleAuthStatusText.style.color = 'orange';
        dom.btnConnectGoogle.style.display = 'inline-block';
        dom.btnDisconnectGoogle.style.display = 'none';
        dom.googleAuthScopesDiv.innerHTML = '';
    }

    if(dom.configGoogleCalendarId) dom.configGoogleCalendarId.value = (currentSettings.googleCalendar && currentSettings.googleCalendar.calendarId) || 'primary';
    if(dom.configTva) dom.configTva.value = currentSettings.tva !== undefined ? currentSettings.tva : '';
    
    if (currentSettings.legal) {
        if(dom.configSiret) dom.configSiret.value = currentSettings.legal.siret || '';
        if(dom.configApe) dom.configApe.value = currentSettings.legal.ape || '';
        if(dom.configAdeli) dom.configAdeli.value = currentSettings.legal.adeli || '';
        if(dom.configIban) dom.configIban.value = currentSettings.legal.iban || '';
        if(dom.configBic) dom.configBic.value = currentSettings.legal.bic || '';
        if(dom.configTvaMention) dom.configTvaMention.value = currentSettings.legal.tvaMention || '';
        if(dom.configPaymentTerms) dom.configPaymentTerms.value = currentSettings.legal.paymentTerms || '';
        if(dom.configInsurance) dom.configInsurance.value = currentSettings.legal.insurance || '';
    }
}

async function handleConfigFormSubmit(event) {
    event.preventDefault();
    const updatedSettings = {
        manager: {
            name: dom.configManagerName.value, 
            title: dom.configManagerTitle.value, 
            description: dom.configManagerDescription.value,
            address: dom.configManagerAddress.value, 
            city: dom.configManagerCity.value,
            phone: dom.configManagerPhone.value, 
            email: dom.configManagerEmailContact.value 
        },
        googleCalendar: {
            calendarId: dom.configGoogleCalendarId.value || 'primary'
        },
        tva: parseFloat(dom.configTva.value) || 0,
        legal: {
            siret: dom.configSiret.value, 
            ape: dom.configApe.value, 
            adeli: dom.configAdeli.value,
            iban: dom.configIban.value, 
            bic: dom.configBic.value, 
            tvaMention: dom.configTvaMention.value,
            paymentTerms: dom.configPaymentTerms.value, 
            insurance: dom.configInsurance.value
        }
    };

    try {
        const savedSettings = await api.saveSettings(updatedSettings);
        
        // Fusionner explicitement les infos OAuth existantes
        const mergedSettings = {
            ...savedSettings,
            googleOAuth: state.appSettings.googleOAuth
        };
        
        state.setAppSettings(mergedSettings);
        showToast('Paramètres enregistrés avec succès.', 'success');
        populateConfigForm(mergedSettings); // Utiliser les paramètres fusionnés
    } catch (error) {
        showToast(`Erreur sauvegarde paramètres: ${error.message}`, 'error');
    }
}

function connectGoogle() {
    window.location.href = `${API_BASE_URL}/auth/google`;
}

async function disconnectGoogle() {
    try {
        if (dom.userProfileDropdown) dom.userProfileDropdown.classList.add('hidden');
        await api.disconnectGoogleAccount();
        showToast('Compte Google déconnecté avec succès.', 'success');
        // Recharger complètement la page pour que le serveur efface le cookie et que l'état soit propre
        window.location.reload();
    } catch (error) {
        showToast(`Erreur lors de la déconnexion : ${error.message}`, 'error');
    }
}
function toggleDropdown() {
    if (dom.userProfileDropdown) {
        dom.userProfileDropdown.classList.toggle('hidden');
    }
}
// Cette fonction gère le retour de la page de connexion
export function handleOAuthCallback() {
    // On vérifie si on est bien redirigé vers la bonne ancre après une connexion réussie
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('oauth_success') && window.location.hash === '#viewConfig') {
        showToast('Compte Google connecté avec succès !', 'success');
        
        // Recharger les données pour refléter le nouvel état de connexion
        Promise.all([
            api.fetchSettings(),
            api.fetchTarifs(),
            api.fetchClients(),
            api.fetchSeances()
        ]).then(() => {
            // Re-populer le formulaire de config et mettre à jour la barre du haut
            populateConfigForm(state.appSettings);
        });
        
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname + "#viewConfig");
    }
}

export function initializeConfigManagement() {
    if (dom.configForm) dom.configForm.addEventListener('submit', handleConfigFormSubmit);
    if (dom.btnConnectGoogle) dom.btnConnectGoogle.addEventListener('click', connectGoogle);
    if (dom.btnDisconnectGoogle) dom.btnDisconnectGoogle.addEventListener('click', disconnectGoogle);
    
   // Le listener est sur le conteneur principal du SVG/avatar
    if (dom.userProfileContainer) {
        dom.userProfileContainer.addEventListener('click', (event) => {
            event.stopPropagation();
            if (state.appSettings.googleOAuth.isConnected) {
                toggleDropdown(); // Si connecté, ouvre le menu
            } else {
                connectGoogle(); // Si déconnecté, lance la connexion
            }
        });
    }

    if (dom.dropdownDisconnectBtn) {
        dom.dropdownDisconnectBtn.addEventListener('click', disconnectGoogle);
    }
    
    window.addEventListener('click', () => {
        if (dom.userProfileDropdown && !dom.userProfileDropdown.classList.contains('hidden')) {
            dom.userProfileDropdown.classList.add('hidden');
        }
    });
}