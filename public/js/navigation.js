// js/navigation.js
import * as dom from './dom.js';
import *as state from './state.js';
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

    window.location.hash = viewId;

    // AJOUT : Gestion de la classe pour la pleine largeur de main
    const mainElement = document.querySelector('main');
    if (mainElement) { // S'assurer que mainElement existe
        if (viewId === 'viewSeances' || viewId === 'viewClients') {
            mainElement.classList.add('main-full-width');
        } else {
            mainElement.classList.remove('main-full-width');
        }
    }
    // FIN DE L'AJOUT

    if (viewId === 'viewDashboard') {
        updateDashboardStats();
    } else if (viewId === 'viewConfig') {
        populateConfigForm(state.appSettings);
        handleOAuthCallback();
    } else if (viewId === 'viewSeances') {
        if (state.seances.length > 0) renderSeancesTable();
    }

    window.scrollTo(0, 0);
}

export function initializeNavigation() {
    dom.navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const viewName = 'view' + button.id.substring(3);
            switchView(viewName);
        });
    });

    function handleHashChange() {
        const hash = window.location.hash.substring(1);
        let viewToDisplay = 'viewSeances';

        if (hash && document.getElementById(hash) && hash.startsWith('view')) {
            viewToDisplay = hash;
        }

        const urlParamsOnInit = new URLSearchParams(window.location.search);
        if (urlParamsOnInit.has('oauth_success') || urlParamsOnInit.has('oauth_error')) {
            viewToDisplay = 'viewConfig';
        }

        switchView(viewToDisplay);
    }

    window.addEventListener('hashchange', handleHashChange);
}