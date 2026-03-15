require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Clé API Gemini (à mettre dans .env)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';

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
 * Appelle l'API Gemini avec le texte OCR et retourne l'analyse structurée.
 */
async function analyzeWithGemini(ocrText) {
  const prompt = `Tu es un assistant qui extrait les données des ordonnances médicales.
Voici le texte OCR d'une ordonnance :

---
${ocrText}
---

Réponds UNIQUEMENT par un objet JSON valide (pas de texte avant ou après), avec exactement cette structure :
{
  "medecin": "nom du médecin si visible",
  "date_ordonnance": "AAAA-MM-JJ si visible",
  "medicaments": [
    {
      "nom": "nom du médicament",
      "dosage": "ex: 500mg, 1 comprimé",
      "forme": "comprime ou gelule ou sirop ou autre",
      "frequence": "1 ou 2 ou 3 (nombre de prises par jour)",
      "instructions": "ex: avec repas, à jeun, matin et soir",
      "duree": "ex: 30 jours, 2 semaines"
    }
  ],
  "note": "autre information utile"
}
Pour chaque médicament trouvé dans l'ordonnance, remplis nom, dosage, forme, frequence (chiffre), instructions et duree. Si une info manque, mets "".`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini API: ${response.status}`);
  }
  if (data?.error) {
    throw new Error(data.error.message || 'Erreur Gemini');
  }

  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  if (!text) throw new Error('Réponse Gemini vide');

  // Extraire le JSON (Gemini peut renvoyer ```json ... ``` ou du texte autour)
  let toParse = text;
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) toParse = codeBlock[1].trim();
  else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) toParse = jsonMatch[0];
  }
  try {
    const parsed = JSON.parse(toParse);
    if (parsed && (Array.isArray(parsed.medicaments) || parsed.medecin != null || parsed.note != null)) return parsed;
  } catch (_) {}
  return { analyse: text };
}

/** Envoi de l'image à Gemini (vision) pour extraire les médicaments. Secours si OCR/Gemini texte échoue. */
async function analyzeWithGeminiVision(imagePath) {
  if (!fs.existsSync(imagePath)) throw new Error('Fichier image introuvable');
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  const base64Image = fs.readFileSync(imagePath).toString('base64');
  const prompt = `Tu vois une ordonnance médicale. Extrais TOUS les médicaments prescrits. Réponds UNIQUEMENT par un JSON valide : {"medecin":"","date_ordonnance":"","medicaments":[{"nom":"...","dosage":"","forme":"comprime|gelule|sachet","frequence":"1|2|3","instructions":"","duree":""}],"note":""}. Liste chaque médicament (nom, dosage, forme, frequence, instructions, duree).`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: base64Image } }, { text: prompt }] }],
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Gemini API ' + response.status);
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  if (!text) throw new Error('Réponse Gemini vision vide');
  let toParse = text;
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) toParse = cb[1].trim();
  else { const m = text.match(/\{[\s\S]*\}/); if (m) toParse = m[0]; }
  const parsed = JSON.parse(toParse);
  if (!Array.isArray(parsed.medicaments)) parsed.medicaments = [];
  return parsed;
}

/**
 * POST /analyze - Ordonnance : OCR + Gemini texte, puis Gemini Vision si 0 médicament.
 */
app.post('/analyze', upload.single('image'), async (req, res) => {
  let imagePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image envoyée. Utilisez le champ "image".' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY manquante dans .env' });
    }

    imagePath = req.file.path;

    // 1. OCR Tesseract (fra puis eng si vide)
    let texteOcr = '';
    for (const lang of ['fra', 'eng']) {
      const worker = await createWorker(lang, 1, { logger: () => {} });
      const { data: { text: ocrText } } = await worker.recognize(imagePath);
      await worker.terminate();
      texteOcr = (ocrText || '').trim();
      if (texteOcr) break;
    }
    if (texteOcr) console.log('[Medical-AI] OCR OK,', texteOcr.length, 'car.');
    else console.warn('[Medical-AI] OCR vide, essai Gemini Vision');

    // 2. Gemini sur le texte OCR
    let analysis = { medicaments: [] };
    if (texteOcr) {
      try {
        analysis = await analyzeWithGemini(texteOcr);
        if (!Array.isArray(analysis.medicaments)) analysis.medicaments = analysis.medicaments || [];
      } catch (err) {
        console.error('[Medical-AI] Gemini:', err.message);
        analysis = { medicaments: [], note: 'Erreur Gemini: ' + err.message, analyse: texteOcr.slice(0, 2000) };
      }
    }

    // 3. Secours : si 0 médicament, envoyer l'image à Gemini Vision
    if (!analysis.medicaments || analysis.medicaments.length === 0) {
      try {
        const visionResult = await analyzeWithGeminiVision(imagePath);
        if (visionResult.medicaments && visionResult.medicaments.length > 0) {
          console.log('[Medical-AI] Gemini Vision:', visionResult.medicaments.length, 'medicament(s)');
          analysis = visionResult;
        }
      } catch (err) {
        console.error('[Medical-AI] Gemini Vision:', err.message);
      }
    }

    res.json({
      succes: true,
      texte_ocr: texteOcr || (analysis.note || ''),
      analyse: analysis,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      succes: false,
      error: err.message || 'Erreur lors de l’analyse.',
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
