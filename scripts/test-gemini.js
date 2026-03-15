/**
 * Test rapide de l'API Gemini (clé + modèle).
 * Usage: node scripts/test-gemini.js
 * À lancer depuis la racine du projet (E-Sante-backend).
 */
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);
require('dotenv').config();

const gemini = require('../IA_E-Sante/lib/gemini-ordonnance');

async function main() {
  console.log('--- Test Gemini ---');
  console.log('GEMINI_API_KEY définie ?', gemini.isGeminiConfigure() ? 'Oui' : 'Non');
  console.log('GEMINI_MODEL (ou défaut) :', process.env.GEMINI_MODEL || 'gemini-2.0-flash');

  if (!gemini.isGeminiConfigure()) {
    console.log('\nAjoutez GEMINI_API_KEY dans le fichier .env');
    process.exit(1);
  }

  // Chercher une image dans uploads pour tester
  const uploadsDir = path.resolve(projectRoot, process.env.UPLOAD_DIR || 'uploads');
  let imagePath = null;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (files.length) imagePath = path.join(uploadsDir, files[0]);
  }

  if (!imagePath) {
    console.log('\nAucune image dans uploads/. Uploadez une ordonnance puis relancez ce script.');
    console.log('Ou test direct de l\'API (sans image)...');
    process.exit(0);
  }

  console.log('\nImage test:', imagePath);
  console.log('Appel Gemini en cours...\n');

  try {
    const result = await gemini.analyserOrdonnanceAvecGemini(imagePath);
    console.log('Succès. Médicaments extraits:', (result.donneesParsees?.medicaments || []).length);
    if (result.donneesParsees?.medicaments?.length) {
      result.donneesParsees.medicaments.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.nom} ${m.dosage || ''}`);
      });
    }
  } catch (err) {
    console.error('Erreur Gemini:');
    console.error('  Message:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
