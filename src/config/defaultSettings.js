module.exports.defaultSettings = {
    manager: {
        name: "", 
        title: "", 
        description: "", 
        address: "", 
        city: "", 
        phone: "", 
        email: "",
    },
    googleOAuth: { 
        userEmail: null,
        refreshToken: null, 
        scopes: []
    },
    tva: 0,
    legal: { 
        siret: "", 
        ape: "", 
        adeli: "", 
        iban: "", 
        bic: "", 
        tvaMention: "TVA non applicable selon l'article 293B du Code Général des Impôts", 
        paymentTerms: "Paiement à réception de facture", 
        insurance: "AXA Assurances - Police n° 123456789 - Garantie territoriale : France/Europe"
    },
    googleCalendar: { 
        calendarId: "primary",
    }
};