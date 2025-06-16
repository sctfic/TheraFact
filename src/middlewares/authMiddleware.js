// middlewares/authMiddleware.js
const { authState } = require('../controllers/authController');

// Vérifie si l'utilisateur est authentifié via Google OAuth
function isGoogleAuthenticated(req, res, next) {
    if (!authState.oauth2Client || !authState.activeGoogleAuthTokens.refreshToken) {
        return res.status(401).json({ 
            message: "Accès non autorisé. Authentification Google requise.",
            requiresAuth: true
        });
    }
    next();
}

// Vérifie si l'utilisateur a les scopes nécessaires
function hasRequiredScopes(requiredScopes = []) {
    return (req, res, next) => {
        if (!authState.activeGoogleAuthTokens.scopes || 
            !requiredScopes.every(scope => authState.activeGoogleAuthTokens.scopes.includes(scope))) {
            return res.status(403).json({ 
                message: "Permissions insuffisantes. Scopes supplémentaires requis.",
                requiredScopes
            });
        }
        next();
    };
}

module.exports = {
    isGoogleAuthenticated,
    hasRequiredScopes
};