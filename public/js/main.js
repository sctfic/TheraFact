// public/js/main.js
import * as api from './api.js';
import * as state from './state.js'; 
import * as dom from './dom.js';
import { initializeNavigation, switchView } from './navigation.js';
import { initializeModal } from './modal.js';
import { initializeClientManagement } from './clients.js';
import { initializeTarifManagement } from './tarifs.js';
import { initializeSeanceManagement } from './seances.js';
import { initializeDashboard, updateDashboardStats }  from './dashboard.js';
import { initializeConfigManagement, populateConfigForm, handleOAuthCallback as handleConfigOAuthCallback, updateTopBarInfo } from './config.js';
import { showToast } from './utils.js';

// MODIFIÉ : La variable et la fonction de statut ont été déplacées
// La gestion se fait maintenant via CSS et les fonctions dédiées.

function setElementHeightCSSVariables() {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer'); 

    if (header) document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    if (footer) document.documentElement.style.setProperty('--footer-height', `${footer.offsetHeight}px`);
}

function autoHideHeaderFooter() {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');

    if (header && footer) {
        setTimeout(() => {
            header.classList.add('hidden-animated');
            footer.classList.add('hidden-animated');
        }, 5000); 
    }
}

function initializeFullscreenButton() {
    const fullscreenBtn = document.getElementById('fullscreenToggleBtn');
    if (!fullscreenBtn) return;

    function updateButtonAppearance() {
        if (!fullscreenBtn) return; 
        if (document.fullscreenElement) {
            fullscreenBtn.src = 'pictures/Reduce.png';
            fullscreenBtn.title = "Quitter le mode plein écran (Esc)";
        } else {
            fullscreenBtn.src = 'pictures/Expand.png';
            fullscreenBtn.title = "Passer en mode plein écran (F11)";
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showToast(`Mode plein écran non supporté ou refusé.`, 'warning');
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateButtonAppearance);
    updateButtonAppearance(); 
}

// MODIFIÉ : Mise à jour de la barre de statut en fonction des classes sur le body
function updateDataStatusBar(settings) {
    const statusBar = document.getElementById('currentDataFolder');
    if (!statusBar) return;

    if (!settings.googleOAuth.isConnected) {
        statusBar.textContent = 'Mode : DEMO';
        document.body.classList.add('demo-mode');
        document.body.classList.remove('authenticated');
    } else {
        statusBar.textContent = `Connecté : ${settings.dataContext}`;
        document.body.classList.add('authenticated');
        document.body.classList.remove('demo-mode');
    }
}


async function initializeApp() {
    // Initialisations de base qui n'attendent pas de données
    initializeNavigation();
    initializeModal();
    initializeFullscreenButton();
    setElementHeightCSSVariables();
    window.addEventListener('resize', setElementHeightCSSVariables);
    
    // Étape 1: Récupérer les paramètres qui déterminent l'état de l'UI globale
    await api.fetchSettings();
    
    // Mettre à jour l'UI globale (icône, contexte) dès que les paramètres sont connus
    updateTopBarInfo(state.appSettings);
    updateDataStatusBar(state.appSettings); // Mettre à jour la barre de statut

    // Étape 2: Récupérer le reste des données en parallèle
    await Promise.all([
        api.fetchTarifs(),   
        api.fetchClients(),  
        api.fetchSeances()
    ]);

    // Étape 3: Initialiser les gestionnaires d'événements pour les vues
    initializeClientManagement();
    initializeTarifManagement();
    initializeSeanceManagement();
    initializeDashboard();
    initializeConfigManagement(); // Initialise aussi les listeners pour l'icône

    // Gérer les redirections OAuth
    handleConfigOAuthCallback(); 

    // Déterminer la vue à afficher
    const currentHash = window.location.hash.substring(1);
    let viewToDisplay = 'viewSeances'; 

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('oauth_success') || urlParams.has('oauth_error')) {
        viewToDisplay = 'viewConfig';
    } else if (currentHash && document.getElementById(currentHash) && currentHash.startsWith('view')) {
        viewToDisplay = currentHash;
    }
    
    switchView(viewToDisplay); 

    // S'assurer que les vues complexes sont bien rendues si elles sont la destination
    if (viewToDisplay === 'viewDashboard' && document.getElementById('viewDashboard')?.classList.contains('active')) {
        updateDashboardStats(); 
    }
    if (viewToDisplay === 'viewConfig' && document.getElementById('viewConfig')?.classList.contains('active')) {
        populateConfigForm(state.appSettings);
    }

    autoHideHeaderFooter();
}

document.addEventListener('DOMContentLoaded', initializeApp);