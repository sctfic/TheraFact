// helpers/documentHelper.js
const { jsPDF } = require("jspdf");
// Ajout du support pour l'encodage UTF-8
// require('jspdf-font-roboto');
const autoTable = require('jspdf-autotable').default;

function generatePdfWithJspdf(data) {
    console.log("generatePdfWithJspdf: Début de la génération du PDF.");
    
    // Créer le document PDF avec encodage UTF-8
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
    });
    
    // Configuration de la police pour supporter les caractères français
    doc.setFont('helvetica');
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let cursorY = margin;

    const isDevis = !!data.devisNumber;
    const docNumber = isDevis ? data.devisNumber : data.invoiceNumber;
    console.log(`generatePdfWithJspdf: Document type: ${isDevis ? 'Devis' : 'Facture'}, Numéro: ${docNumber}`);
    
    const docDate = isDevis ? data.devisDate : data.invoiceDate;
    const effectiveDueDateOrValidity = isDevis ? data.validityDate : data.dueDate;
    const docTitle = isDevis ? 'DEVIS' : 'FACTURE';
    const clientLabel = isDevis ? "Adressé à :" : "Facturé à :";

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};
    
   // --- Entête améliorée ---
   const headerY = margin;
   doc.setFontSize(10);
   doc.setFont('helvetica', 'bold');
   
   // Bloc gauche (coordonnées cabinet)
   doc.text(manager.name || 'Nom du gestionnaire', margin, headerY);
   doc.setFont('helvetica', 'normal');
   let nextY = headerY + 5;
   if(manager.title) { 
       doc.text(manager.title, margin, nextY); 
       nextY += 5;
   }
   if(manager.address) { 
       doc.text(manager.address, margin, nextY);
       nextY += 5;
   }
   if(manager.city) {
       doc.text(manager.city, margin, nextY);
       nextY += 5;
   }
   if(manager.phone) {
       doc.text(`Téléphone : ${manager.phone}`, margin, nextY);
       nextY += 5;
   }
   if(manager.email) {
       doc.text(`Email : ${manager.email}`, margin, nextY);
       nextY += 5;
   }

   // Bloc droit (numéro + dates)
   const rightX = 210 - margin;
   doc.setFont('helvetica', 'bold');
   doc.text(`${isDevis ? 'Devis N°' : 'Facture N°'} : ${docNumber}`, rightX, headerY, { align: 'right' });
   doc.setFont('helvetica', 'normal');
   doc.text(`Date d'émission : ${docDate}`, rightX, headerY + 5, { align: 'right' });
   const dueLabel = isDevis ? "Valide jusqu'au :" : "Date d'échéance :";
   doc.text(`${dueLabel} ${effectiveDueDateOrValidity}`, rightX, headerY + 10, { align: 'right' });

   // --- Titre centré ---
   cursorY = Math.max(nextY, headerY + 20) + 10;
   doc.setFontSize(22);
   doc.setFont('helvetica', 'bold');
   doc.text(docTitle, 105, cursorY, { align: 'center' });
   cursorY += 15;

   // --- Client ---
   doc.setFontSize(11);
   doc.setFont('helvetica', 'bold');
   doc.text(clientLabel, margin, cursorY);
   cursorY += 6;
   doc.setFont('helvetica', 'normal');
   doc.text(client.name || 'Nom du client', margin, cursorY);
   cursorY += 5;
   if(client.address) { 
       doc.text(client.address, margin, cursorY); 
       cursorY += 5;
   }
   if(client.city) { 
       doc.text(client.city, margin, cursorY); 
       cursorY += 5;
   }
   cursorY += 10;

    // --- Tableau des prestations ---
    console.log("generatePdfWithJspdf: Préparation et dessin du tableau des prestations.");
    const formatCurrency = (value) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value || 0);
        return numValue.toFixed(2).replace('.', ',') + ' €';
    };
    
    const tableBody = data.service.map(item => [
        item.Date || docDate,
        item.description || 'Service',
        (item.quantity || 1).toString(),
        formatCurrency(item.unitPrice),
        formatCurrency((item.quantity || 1) * (item.unitPrice || 0))
    ]);

    // Calculer les totaux
    const total_ht = data.service.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);
    const tvaRate = parseFloat(data.tva) || 0;
    const tvaAmount = total_ht * (tvaRate / 100);
    const total_ttc = total_ht + tvaAmount;

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Qté', 'P.U. (€)', 'Total HT (€)']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
            fillColor: [240, 240, 240], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            fontSize: 10
        },
        bodyStyles: { 
            fontSize: 9,
            textColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 }
        },
        styles: {
            cellPadding: 3,
            lineColor: [0, 0, 0],
            lineWidth: 0.1
        },
        didDrawPage: (data) => {
            cursorY = data.cursor.y;
        }
    });
    console.log("generatePdfWithJspdf: Tableau des prestations dessiné.");

    cursorY += 5;
   // --- Totaux alignés à droite ---
   cursorY += 10;
   doc.setFont('helvetica', 'normal');
   doc.text(`Total HT: ${formatCurrency(total_ht)}`, rightX, cursorY, { align: 'right' });
   cursorY += 7;
   doc.text(`TVA (${tvaRate.toFixed(2).replace('.', ',')}%): ${formatCurrency(tvaAmount)}`, rightX, cursorY, { align: 'right' });
   cursorY += 7;
   doc.setFont('helvetica', 'bold');
   doc.text(`Total TTC: ${formatCurrency(total_ttc)}`, rightX, cursorY, { align: 'right' });
   cursorY += 12;

   // Montant à régeler
   const paymentLabel = isDevis ? "MONTANT TOTAL DU DEVIS :" : "MONTANT À RÉGLER :";
   doc.text(`${paymentLabel} ${formatCurrency(total_ttc)}`, rightX, cursorY, { align: 'right' });
   cursorY += 20;

   // --- Mentions légales structurées ---
   doc.setLineWidth(0.5);
   doc.line(margin, cursorY, 210 - margin, cursorY);
   cursorY += 8;

   doc.setFontSize(10);
   doc.setFont('helvetica', 'bold');
   doc.text("Mentions Légales", margin, cursorY);
   cursorY += 6;
   
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   
   // Colonne gauche
   doc.text(`SIRET : ${legal.siret || 'N/A'}`, margin, cursorY);
   doc.text(`Code APE : ${legal.ape || 'N/A'}`, margin, cursorY + 5);
   doc.text(`N° ADELI : ${legal.adeli || 'N/A'}`, margin, cursorY + 10);
   
   // Colonne droite
   doc.text(`IBAN : ${legal.iban || 'N/A'}`, 110, cursorY);
   doc.text(`BIC : ${legal.bic || 'N/A'}`, 110, cursorY + 5);
   
   cursorY += 15;
   
   // Mentions TVA
   const tvaText = legal.tvaMention || 
                  (tvaRate === 0 ? "TVA non applicable - Art. 293B du CGI" : 
                   `TVA applicable au taux de ${tvaRate.toFixed(2).replace('.', ',')}%`);
   doc.text(tvaText, margin, cursorY, { maxWidth: 180 });
   cursorY += 10;
   
   // Conditions de paiement
   if (!isDevis) {
       doc.text(`Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}`, 
               margin, cursorY, { maxWidth: 180 });
       cursorY += 10;
   }
   
   // Assurance
   doc.text(`Assurance RCP : ${legal.insurance || 'N/A'}`, margin, cursorY, { maxWidth: 180 });


    console.log("generatePdfWithJspdf: Génération du buffer de sortie du PDF.");
    
    // Générer le buffer PDF
    const pdfOutput = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfOutput);
    
    console.log(`generatePdfWithJspdf: PDF finalisé. Taille : ${pdfBuffer.byteLength} octets.`);
    return pdfBuffer;
}

module.exports = {
    generatePdfWithJspdf
};