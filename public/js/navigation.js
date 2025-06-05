// js/navigation.js
import * as dom from './dom.js';
import * as state from './state.js';
import { populateConfigForm, handleOAuthCallback } from './config.js';
import { updateDashboardStats, displaySessionsTrendChart } from './dashboard.js';
import { renderSeancesTable } from './seances.js';


export function switchView(viewId) {
    dom.views.forEach(view => view.classList.remove('active'));
    dom.navButtons.forEach(btn => btn.classList.remove('active'));
    
    const currentView = document.getElementById(viewId);
    if (currentView) currentView.classList.add('active');
    
    const navButtonId = viewId.replace('view', 'nav');
    const currentNavButton = document.getElementById(navButtonId);
    if (currentNavButton) currentNavButton.classList.add('active');
    
    // Mettre à jour le hash de l'URL pour la navigation par signet/historique
    window.location.hash = viewId;

    // Actions spécifiques à la vue
    if (viewId === 'viewDashboard') {
        updateDashboardStats(); // displaySessionsTrendChart est appelé par updateDashboardStats
    } else if (viewId === 'viewConfig') {
        populateConfigForm(state.appSettings); // Passer les settings actuels
        handleOAuthCallback(); // Gérer les retours OAuth si on arrive sur cette page
    } else if (viewId === 'viewSeances') {
        if (state.seances.length > 0) renderSeancesTable();
    }
}

export function initializeNavigation() {
    dom.navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Le nom de la vue est dérivé de l'ID du bouton: navClients -> viewClients
            const viewName = 'view' + button.id.substring(3);
            switchView(viewName);
        });
    });

    // Gérer la navigation par hash au chargement initial ou au changement de hash
    function handleHashChange() {
        const hash = window.location.hash.substring(1); // Enlever le '#'
        let viewToDisplay = 'viewSeances'; // Vue par défaut

        if (hash && document.getElementById(hash) && hash.startsWith('view')) {
            viewToDisplay = hash;
        }
        // Gérer les cas où le hash ne correspond pas à une vue valide ou est vide
        // (déjà fait par la valeur par défaut viewSeances)
        
        const urlParamsOnInit = new URLSearchParams(window.location.search);
        if (urlParamsOnInit.has('oauth_success') || urlParamsOnInit.has('oauth_error')) {
             // Si on vient d'un callback OAuth, forcer la vue de configuration
            viewToDisplay = 'viewConfig';
        }
        
        switchView(viewToDisplay);
    }

    window.addEventListener('hashchange', handleHashChange);
    // Gérer le hash initial au chargement de la page
    // handleHashChange(); // Sera appelé par initializeApp après le fetch des données
}