// public/js/utils.js
import * as dom from './dom.js';

export function showDemoAlert() {
    if (document.querySelector('.demo-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'demo-modal';
    modal.innerHTML = `
        <div class="demo-modal-content">
            <h3>Action non disponible en mode DEMO</h3>
            <p>Cette fonctionnalité nécessite une connexion à un compte Google. Veuillez vous connecter via l'onglet "Config".</p>
            <div style="display: flex; justify-content: center; gap: 10px; margin-top: 1rem;">
                <button id="demoModalClose" class="btn btn-primary">Fermer</button>
                <button id="demoModalConnect" class="btn btn-success">Se connecter</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // MODIFIÉ : Utilisation de la référence depuis dom.js
    if (dom.currentDataFolder) {
        dom.currentDataFolder.classList.add('animating-demo');
    }

    const closeModalAndAnimation = () => {
        modal.remove();
        if (dom.currentDataFolder) {
            dom.currentDataFolder.classList.remove('animating-demo');
        }
    };

    document.getElementById('demoModalClose').addEventListener('click', closeModalAndAnimation);
    
    document.getElementById('demoModalConnect').addEventListener('click', () => {
        closeModalAndAnimation();
        // Simule un clic pour aller à l'onglet config, puis sur le bouton de connexion
        if (dom.navConfig) dom.navConfig.click();
        if (dom.btnConnectGoogle) dom.btnConnectGoogle.click();
    });
}


export function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

export function showToast(message, type = 'info') {
    if (type !== 'success' && type !== 'error' && type !== 'warning') {
        if (message.toLowerCase().includes('succès') || message.toLowerCase().includes('succes') || message.toLowerCase().includes('envoyée') || message.toLowerCase().includes('réussie') || message.toLowerCase().includes('connecté')) type = 'success';
        else if (message.toLowerCase().includes('erreur') || message.toLowerCase().includes('échec') || message.toLowerCase().includes('déconnecté')) type = 'error';
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
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.transform = 'translateX(110%)'; 

    if (type === 'success') toast.style.background = '#28a745';
    else if (type === 'error') toast.style.background = '#dc3545';
    else if (type === 'warning') toast.style.background = '#ffc107';
    else toast.style.background = '#007bff'; 

    document.body.appendChild(toast);
    
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 50);
    setTimeout(() => {
        toast.style.transform = 'translateX(110%)'; 
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400); 
    }, 3500); 
}

export function getApiBaseUrl() {
    const appBaseUrl = window.location.origin;
    return `${appBaseUrl.replace(/:\d+$/, '')}/api`;
}

export function getAppBaseUrl() {
    return window.location.origin;
}