// js/main.js
import * as api from './api.js';
import * as state from './state.js'; 
import { initializeNavigation, switchView } from './navigation.js';
import { initializeModal } from './modal.js';
import { initializeClientManagement } from './clients.js';
import { initializeTarifManagement } from './tarifs.js';
import { initializeSeanceManagement } from './seances.js';
import { initializeDashboard, updateDashboardStats }  from './dashboard.js';
import { initializeConfigManagement, populateConfigForm, handleOAuthCallback as handleConfigOAuthCallback } from './config.js';
import { showToast } from './utils.js';

// Fonction pour définir les hauteurs des éléments en variables CSS (peut rester pour d'autres usages)
function setElementHeightCSSVariables() {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer'); 

    if (header) document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    if (footer) document.documentElement.style.setProperty('--footer-height', `${footer.offsetHeight}px`);
}

// Modifiée pour cibler header et footer et utiliser la classe 'hidden-animated'
function autoHideHeaderFooter() {
    const header = document.querySelector('header'); // Cible le header
    const footer = document.querySelector('footer'); // Cible le footer

    if (header && footer) {
        // Pas besoin d'appeler setElementHeightCSSVariables ici pour cette animation
        setTimeout(() => {
            header.classList.add('hidden-animated'); // Utilise la classe existante ou une nouvelle
            footer.classList.add('hidden-animated'); // pour le rétrécissement
        }, 5000); 
    }
}

// Fonction pour le bouton plein écran (inchangée)
function initializeFullscreenButton() {
    const fullscreenBtn = document.getElementById('fullscreenToggleBtn');
    if (!fullscreenBtn) {
        return;
    }

    const enterFullscreenSymbol = '&#x26F6;'; 
    const exitFullscreenSymbol = '&#x274C;';  

    function updateButtonAppearance() {
        if (!fullscreenBtn) return; 
        if (document.fullscreenElement) {
            fullscreenBtn.innerHTML = exitFullscreenSymbol;
            fullscreenBtn.title = "Quitter le mode plein écran (Esc)";
        } else {
            fullscreenBtn.innerHTML = enterFullscreenSymbol;
            fullscreenBtn.title = "Passer en mode plein écran (F11)";
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .catch(err => {
                    if (typeof showToast === 'function') {
                        showToast(`Mode plein écran non supporté ou refusé.`, 'warning');
                    } else {
                        console.warn(`Erreur lors du passage en mode plein écran: ${err.message} (${err.name})`);
                    }
                });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    if (fullscreenBtn) { 
       fullscreenBtn.addEventListener('click', toggleFullscreen);
       document.addEventListener('fullscreenchange', updateButtonAppearance);
       updateButtonAppearance(); 
    }
}


async function initializeApp() {
    initializeNavigation();
    initializeModal();
    initializeFullscreenButton(); 
    
    setElementHeightCSSVariables(); 
    window.addEventListener('resize', setElementHeightCSSVariables); 

    await api.fetchSettings(); 
    await api.fetchTarifs();   
    await api.fetchClients();  
    await api.fetchSeances();  

    initializeClientManagement();
    initializeTarifManagement();
    initializeSeanceManagement();
    initializeDashboard();
    initializeConfigManagement();

    handleConfigOAuthCallback(); 

    const currentHash = window.location.hash.substring(1);
    let viewToDisplay = 'viewSeances'; 

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('oauth_success') || urlParams.has('oauth_error')) {
        viewToDisplay = 'viewConfig';
    } else if (currentHash && document.getElementById(currentHash) && currentHash.startsWith('view')) {
        viewToDisplay = currentHash;
    }
    
    switchView(viewToDisplay); 

    if (viewToDisplay === 'viewDashboard' && document.getElementById('viewDashboard')?.classList.contains('active')) {
        updateDashboardStats(); 
    }
    if (viewToDisplay === 'viewConfig' && document.getElementById('viewConfig')?.classList.contains('active')) {
        populateConfigForm(state.appSettings);
    }

    autoHideHeaderFooter();
}

document.addEventListener('DOMContentLoaded', initializeApp);