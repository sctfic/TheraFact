// js/utils.js
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
    // Utiliser l'origine actuelle de la fenêtre pour construire les URLs de base
    // Cela suppose que votre serveur API tourne sur le même domaine/port ou que vous avez un proxy.
    // Si le port est différent (ex: 3000 pour le serveur Node.js), vous devez le gérer.
    // Pour l'instant, nous allons supposer que le port 3000 est toujours nécessaire pour l'API.
    const appBaseUrl = window.location.origin; // ex: http://fact.lpz.ovh ou http://localhost:xxxx
    return `${appBaseUrl.replace(/:\d+$/, '')}:3000/api`; // Assure que le port est 3000 pour l'API
}

export function getAppBaseUrl() {
    return window.location.origin;
}