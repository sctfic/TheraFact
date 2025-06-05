// js/config.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast, getApiBaseUrl } from './utils.js';

const API_BASE_URL = getApiBaseUrl();

export function populateConfigForm(currentSettings = state.appSettings) {
    if (!currentSettings || !dom.configForm) return;
    
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
                else if (scope.includes('userinfo.profile')) readableScope = "Voir vos informations de profil basiques";
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
        // Ne pas inclure googleOAuth ici, car il est géré par les endpoints OAuth dédiés
    };

    try {
        const savedSettings = await api.saveSettings(updatedSettings);
        state.setAppSettings(savedSettings); // Mettre à jour l'état global
        showToast('Paramètres enregistrés avec succès.', 'success');
        populateConfigForm(savedSettings); // Re-populer avec les données sauvegardées (au cas où le backend modifie qqch)
    } catch (error) {
        showToast(`Erreur sauvegarde paramètres: ${error.message}`, 'error');
    }
}

function connectGoogle() {
    window.location.href = `${API_BASE_URL}/auth/google`;
}

async function disconnectGoogle() {
    try {
        await api.disconnectGoogleAccount();
        showToast('Compte Google déconnecté avec succès.', 'success');
        // Rafraîchir les paramètres pour mettre à jour l'UI
        await api.fetchSettings(); 
        populateConfigForm(state.appSettings); 
    } catch (error) {
        showToast(`Erreur lors de la déconnexion : ${error.message}`, 'error');
    }
}

export function handleOAuthCallback() { // Exportée pour navigation.js
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('oauth_success')) {
        showToast('Compte Google connecté avec succès !', 'success');
        api.fetchSettings().then(() => populateConfigForm(state.appSettings)); // S'assurer que les settings sont à jour
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname + "#viewConfig");
    } else if (urlParams.has('oauth_error')) {
        showToast(`Erreur de connexion Google : ${urlParams.get('oauth_error')}`, 'error');
        window.history.replaceState({}, document.title, window.location.pathname + "#viewConfig");
    }
}

export function initializeConfigManagement() {
    if (dom.configForm) dom.configForm.addEventListener('submit', handleConfigFormSubmit);
    if (dom.btnConnectGoogle) dom.btnConnectGoogle.addEventListener('click', connectGoogle);
    if (dom.btnDisconnectGoogle) dom.btnDisconnectGoogle.addEventListener('click', disconnectGoogle);
    
    // S'assurer que le formulaire est peuplé si on arrive directement sur la vue config
    // (généralement géré par switchView, mais une vérification ici peut être utile)
    if (dom.viewConfig && dom.viewConfig.classList.contains('active')) {
        populateConfigForm(state.appSettings);
    }
}