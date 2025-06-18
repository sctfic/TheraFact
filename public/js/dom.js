// public/js/dom.js
export const navButtons = document.querySelectorAll('.nav-btn');
export const views = document.querySelectorAll('.view');
// MODIFIÉ : Correction des références pour la barre de statut
export const dataStatusBar = document.getElementById('dataStatusBar');
export const currentDataFolder = document.getElementById('currentDataFolder');


// Profil utilisateur et menu déroulant
export const userProfileContainer = document.getElementById('userProfileContainer');
export const svgInnerImage = document.getElementById('svgInnerImage'); // Nouvel élément à contrôler
export const userProfileDropdown = document.getElementById('userProfileDropdown');
export const dropdownUserName = document.getElementById('dropdownUserName');
export const dropdownUserEmail = document.getElementById('dropdownUserEmail');
export const dropdownDisconnectBtn = document.getElementById('dropdownDisconnectBtn');
export const navConfig = document.getElementById('navConfig'); // Ajout pour le lien direct

// Clients
export const clientFormContainer = document.getElementById('clientFormContainer');
export const clientForm = document.getElementById('clientForm');
// export const clientFormTitle = document.getElementById('clientFormTitle');
export const clientsTableBody = document.querySelector('#clientsTable tbody');
export const btnAddClient = document.getElementById('btnAddClient');
export const cancelClientFormBtn = document.getElementById('cancelClientForm');
export const searchClientInput = document.getElementById('searchClientInput');
export const filterClientStatut = document.getElementById('filterClientStatut');
export const clientDefaultTarifSelect = document.getElementById('clientDefaultTarif');
export const clientNomInput = document.getElementById('clientNom');
export const clientPrenomInput = document.getElementById('clientPrenom');
export const clientTelephoneInput = document.getElementById('clientTelephone');
export const clientEmailInput = document.getElementById('clientEmail');
export const clientAdresseInput = document.getElementById('clientAdresse');
export const clientVilleInput = document.getElementById('clientVille');
export const clientNotesInput = document.getElementById('clientNotes');
export const clientIdInput = document.getElementById('clientId'); // Pour le formulaire client

// Tarifs
export const tarifFormContainer = document.getElementById('tarifFormContainer');
export const tarifForm = document.getElementById('tarifForm');
// export const tarifFormTitle = document.getElementById('tarifFormTitle');
export const tarifsTableBody = document.querySelector('#tarifsTable tbody');
export const btnAddTarif = document.getElementById('btnAddTarif');
export const cancelTarifFormBtn = document.getElementById('cancelTarifForm');
export const tarifLibelleInput = document.getElementById('tarifLibelle');
export const tarifDureeInput = document.getElementById('tarifDuree');
export const tarifMontantInput = document.getElementById('tarifMontant');
export const tarifIdInput = document.getElementById('tarifId'); // Pour le formulaire tarif

// Séances
export const seanceFormContainer = document.getElementById('seanceFormContainer');
export const seanceForm = document.getElementById('seanceForm');
// export const seanceFormTitle = document.getElementById('seanceFormTitle');
export const seancesTableBody = document.querySelector('#seancesTable tbody');
export const btnAddSeance = document.getElementById('btnAddSeance');
export const cancelSeanceFormBtn = document.getElementById('cancelSeanceForm');
export const seanceClientNameInput = document.getElementById('seanceClientNameInput');
if (seanceClientNameInput) seanceClientNameInput.setAttribute('autocomplete', 'off');
export const seanceClientIdInput = document.getElementById('seanceClientIdInput'); // Hidden input
export const clientAutocompleteResults = document.getElementById('clientAutocompleteResults');
export const seanceTarifSelect = document.getElementById('seanceTarif');
export const seanceMontantInput = document.getElementById('seanceMontant');
export const seanceStatutSelect = document.getElementById('seanceStatut');
export const seanceModePaiementGroup = document.getElementById('seanceModePaiementGroup');
export const seanceDatePaiementGroup = document.getElementById('seanceDatePaiementGroup');
export const seanceModePaiementSelect = document.getElementById('seanceModePaiement');
export const seanceDatePaiementInput = document.getElementById('seanceDatePaiement'); // Champ date de paiement
export const seanceDateElement = document.getElementById('seanceDate'); // Champ date & heure séance
export const seanceIdInput = document.getElementById('seanceId'); // Hidden input for seance ID
export const searchSeanceClientInput = document.getElementById('searchSeanceClientInput');
export const filterSeanceStatut = document.getElementById('filterSeanceStatut');
export const filterSeanceDateStart = document.getElementById('filterSeanceDateStart');
export const filterSeanceDateEnd = document.getElementById('filterSeanceDateEnd');
export const clearSeanceFiltersBtn = document.getElementById('clearSeanceFilters');
export const availabilityInfoContainer = document.getElementById('availabilityInfoContainer');
export const availabilityList = document.getElementById('availabilityList');


// Modale de suppression
export const deleteConfirmModal = document.getElementById('deleteConfirmModal');
export const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
export const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
export const deleteModalTitle = document.getElementById('deleteModalTitle');
export const deleteModalMessage = document.getElementById('deleteModalMessage');

// Dashboard
export const statClientsCount = document.getElementById('statClientsCount');
export const statSeancesCount = document.getElementById('statSeancesCount');
export const statSeancesPayees = document.getElementById('statSeancesPayees');
export const caMoisPrecedent = document.getElementById('caMoisPrecedent');
export const caMoisEnCours = document.getElementById('caMoisEnCours');
export const caAnneePrecedente = document.getElementById('caAnneePrecedente');
export const caAnneeEnCours = document.getElementById('caAnneeEnCours');
export const chartPeriodSelector = document.getElementById('chartPeriodSelector');
export const sessionsTrendChartContainer = document.getElementById('sessionsTrendChartContainer');

// Configuration
export const configForm = document.getElementById('configForm');
export const configManagerName = document.getElementById('configManagerName');
export const configManagerTitle = document.getElementById('configManagerTitle');
export const configManagerDescription = document.getElementById('configManagerDescription');
export const configManagerAddress = document.getElementById('configManagerAddress');
export const configManagerCity = document.getElementById('configManagerCity');
export const configManagerPhone = document.getElementById('configManagerPhone');
export const configManagerEmailContact = document.getElementById('configManagerEmailContact');
export const configGoogleCalendarId = document.getElementById('configGoogleCalendarId');
export const googleAuthStatusContainer = document.getElementById('googleAuthStatusContainer');
export const googleAuthStatusText = document.getElementById('googleAuthStatusText');
export const googleAuthScopesDiv = document.getElementById('googleAuthScopes');
export const btnConnectGoogle = document.getElementById('btnConnectGoogle');
export const btnDisconnectGoogle = document.getElementById('btnDisconnectGoogle');
export const configTva = document.getElementById('configTva');
export const configSiret = document.getElementById('configSiret');
export const configApe = document.getElementById('configApe');
export const configAdeli = document.getElementById('configAdeli');
export const configIban = document.getElementById('configIban');
export const configBic = document.getElementById('configBic');
export const configTvaMention = document.getElementById('configTvaMention');
export const configPaymentTerms = document.getElementById('configPaymentTerms');
export const configInsurance = document.getElementById('configInsurance');

// Vue active
export const viewSeances = document.getElementById('viewSeances');
export const viewClients = document.getElementById('viewClients');
export const viewTarifs = document.getElementById('viewTarifs');
export const viewDashboard = document.getElementById('viewDashboard');
export const viewConfig = document.getElementById('viewConfig');