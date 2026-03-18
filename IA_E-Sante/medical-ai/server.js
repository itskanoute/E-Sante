require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Dossier pour les uploads (temporaires pour OCR)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer : réception des images (champ "image" dans le formulaire)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `ocr-${Date.now()}${path.extname(file.originalname) || '.png'}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|png|gif|webp|bmp)/.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez une image (JPEG, PNG, GIF, WebP, BMP).'));
  },
});

// Servir un formulaire HTML simple pour les tests
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /analyze
 * Important : pour respecter la confidentialité, cette route NE FAIT AUCUN APPEL à l'API Gemini.
 * Elle fait uniquement l'OCR local (Tesseract) et renvoie le texte brut.
 * Le backend E-Santé peut ensuite appliquer son propre fallback local pour extraire des médicaments.
 */
app.post('/analyze', upload.single('image'), async (req, res) => {
  let imagePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ succes: false, error: 'Aucune image envoyée. Utilisez le champ \"image\".' });
    }

    imagePath = req.file.path;

    // OCR Tesseract (fra puis eng si nécessaire)
    let texteOcr = '';
    for (const lang of ['fra', 'eng']) {
      const worker = await createWorker(lang, 1, { logger: () => {} });
      const { data: { text: ocrText } } = await worker.recognize(imagePath);
      await worker.terminate();
      texteOcr = (ocrText || '').trim();
      if (texteOcr) break;
    }

    if (!texteOcr) {
      console.warn('[Medical-AI] OCR vide sur l\'image envoyée.');
      return res.status(200).json({
        succes: true,
        texte_ocr: '',
        analyse: {
          medecin: '',
          date_ordonnance: '',
          medicaments: [],
          note: 'OCR vide — aucune donnée exploitable extraite.',
        },
      });
    }

    console.log('[Medical-AI] OCR OK,', texteOcr.length, 'caractères (aucune donnée envoyée à un service externe).');

    // Par conception, on ne contacte PAS Gemini ici.
    // On renvoie simplement le texte OCR et une structure d'analyse vide.
    res.json({
      succes: true,
      texte_ocr: texteOcr,
      analyse: {
        medecin: '',
        date_ordonnance: '',
        medicaments: [],
        note: 'Extraction IA distante désactivée. Le backend appliquera un traitement local sur le texte OCR si nécessaire.',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      succes: false,
      error: err.message || 'Erreur lors de l’analyse OCR locale.',
    });
  } finally {
    // Suppression de l’image temporaire
    if (imagePath && fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch (_) {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`Medical AI écoute sur http://localhost:${PORT}`);
  console.log('POST /analyze avec champ "image" (utilisé par le backend E-Santé pour le scan d\'ordonnances).');
});
