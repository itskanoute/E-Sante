const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { Ordonnance } = require('../models');
const traitementService = require('./traitement.service');

const MEDICAL_AI_URL = (process.env.MEDICAL_AI_URL || 'http://localhost:3001').replace(/\/$/, '');
// Si le service IA tourne sur 3000 au lieu de 3001, on essaie les deux
const MEDICAL_AI_FALLBACK = MEDICAL_AI_URL.includes('3001') ? 'http://localhost:3000' : 'http://localhost:3001';

/**
 * Fallback : extraire des noms de médicaments depuis le texte OCR brut (si l'IA n'a pas renvoyé de JSON structuré).
 * Détecte "MEDICAMENT A/B/C/D", "Médicament X", ou lignes avec gélule/comprimé/sachet.
 */
function extraireMedicamentsDepuisTexte(texte) {
  if (!texte || typeof texte !== 'string') return [];
  const result = [];
  const normalized = texte.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lignes = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1) Découper par "MEDICAMENT A", "MEDICAMENT B", etc. (avec ou sans accent, espace variable)
  const blocs = normalized.split(/\b(?:MEDICAMENT|M[eéè]dicament)\s*([A-Z])\b/gi);
  for (let i = 1; i < blocs.length; i += 2) {
    const lettre = blocs[i].trim().charAt(0).toUpperCase();
    const nom = 'MEDICAMENT ' + lettre;
    const instructions = (blocs[i + 1] || '').replace(/\n+/g, ' ').trim().slice(0, 400);
    if (!result.some((m) => m.nom === nom)) {
      const formeMatch = instructions.match(/(gélule|gelule|comprimé|comprime|sachet|injection|sirop)/i);
      result.push({
        nom,
        dosage: '',
        forme: formeMatch ? formeMatch[1].toLowerCase().replace('gelule', 'gélule').replace('comprime', 'comprimé') : 'comprime',
        frequence: '1',
        instructions,
        duree: '',
      });
    }
  }

  // 2) Ligne par ligne : "MEDICAMENT A" ou "Médicament A" suivi d'instructions
  const formes = /\b(gélule|gelule|comprimé|comprime|cp|sachet|injection|sirop)\b/i;
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const matchMed = ligne.match(/(?:MEDICAMENT|M[eéè]dicament)\s*([A-Z])\b/i);
    if (matchMed) {
      const nom = 'MEDICAMENT ' + matchMed[1].toUpperCase();
      if (result.some((m) => m.nom === nom)) continue;
      const reste = ligne.replace(matchMed[0], '').replace(/^[\s\-–]+/, '').trim();
      const nextLine = lignes[i + 1] || '';
      const instructions = (reste || nextLine).slice(0, 300);
      const formeFromLine = (reste + nextLine).match(/(gélule|gelule|comprimé|comprime|sachet|injection|sirop)/i);
      result.push({
        nom,
        dosage: '',
        forme: formeFromLine ? formeFromLine[1].toLowerCase().replace('gelule', 'gélule').replace('comprime', 'comprimé') : 'comprime',
        frequence: '1',
        instructions,
        duree: '',
      });
      continue;
    }
    if (formes.test(ligne)) {
      const idx = ligne.search(formes);
      const avant = ligne.slice(0, idx).trim();
      const nom = (avant.match(/^([A-Za-z0-9\s\-]+?)\s*[\-–]?\s*\d/) || [null, avant])[1]?.trim() || avant.slice(0, 80);
      if (nom && nom.length > 1 && !/^\d+$/.test(nom) && !result.some((m) => m.nom === nom)) {
        const formeMatch = ligne.match(/(gélule|gelule|comprimé|comprime|sachet|injection|sirop)/i);
        result.push({
          nom: nom.replace(/\s+/g, ' ').trim(),
          dosage: '',
          forme: (formeMatch && formeMatch[1]) ? formeMatch[1].toLowerCase().replace('gelule', 'gélule').replace('comprime', 'comprimé') : 'comprime',
          frequence: '1',
          instructions: ligne.slice(0, 300).trim(),
          duree: '',
        });
      }
    }
  }

  return result.filter((m) => m.nom && m.nom.length > 0);
}

/**
 * Retourne le chemin absolu du fichier uploadé (multer peut donner un chemin relatif).
 */
function getFilePath(file) {
  if (!file) return null;
  const base = process.cwd();
  const candidates = [
    file.path,
    path.join(process.env.UPLOAD_DIR || 'uploads', file.filename),
    path.join(base, process.env.UPLOAD_DIR || 'uploads', file.filename),
    path.join(base, 'uploads', file.filename),
  ].filter(Boolean);
  for (const p of candidates) {
    const abs = path.isAbsolute(p) ? p : path.resolve(base, p);
    if (fs.existsSync(abs)) return abs;
  }
  return path.isAbsolute(candidates[0]) ? candidates[0] : path.resolve(base, candidates[0] || '');
}

const IA_TIMEOUT_MS = 120000; // 2 min (OCR + Gemini peut être long)

/**
 * POST multipart vers une URL ; retourne le body JSON. Timeout 2 min.
 */
function postFormDataFile(urlStr, filePath, fieldName = 'image', filename = 'image.jpg') {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const FormData = require('form-data');
    const form = new FormData();
    form.append(fieldName, fs.createReadStream(filePath), { filename });

    const opts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      headers: form.getHeaders(),
    };
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ statusCode: res.statusCode, data: body ? JSON.parse(body) : {} });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Service IA timeout (2 min)'));
    }, IA_TIMEOUT_MS);
    req.on('close', () => clearTimeout(timeout));
    form.pipe(req);
  });
}

/**
 * Appelle le service IA (medical-ai) pour extraire texte + médicaments de l'image.
 * Retourne { texte_ocr, donnees_parsees } ou null si service indisponible.
 */
async function appelerServiceIA(filePath, originalName) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn('[Ordonnance] Fichier introuvable pour l\'IA:', filePath);
    return null;
  }
  const urlsToTry = [MEDICAL_AI_URL, MEDICAL_AI_FALLBACK].filter((u, i, a) => a.indexOf(u) === i);
  let successJson = null;
  for (const baseUrl of urlsToTry) {
    try {
      console.log('[Ordonnance] Appel IA:', baseUrl + '/analyze');
      const { statusCode, data: json } = await postFormDataFile(
        `${baseUrl}/analyze`,
        filePath,
        'image',
        originalName || 'ordonnance.jpg'
      );
      if (statusCode !== 200) {
        console.warn('[Ordonnance] IA a répondu', statusCode, 'sur', baseUrl, json?.error || json);
        continue;
      }
      if (!json.succes) {
        console.warn('[Ordonnance] IA erreur:', json.error || 'succes=false');
        return null;
      }
      successJson = json;
      const nbMed = (json.analyse?.medicaments && Array.isArray(json.analyse.medicaments)) ? json.analyse.medicaments.length : 0;
      console.log('[Ordonnance] Réponse IA (', baseUrl, '): texte_ocr=', (json.texte_ocr || '').length, 'car., médicaments=', nbMed);
      break;
    } catch (err) {
      if (err.code === 'ECONNREFUSED' && urlsToTry.indexOf(baseUrl) < urlsToTry.length - 1) {
        console.warn('[Ordonnance]', baseUrl, 'indisponible, essai', MEDICAL_AI_FALLBACK);
        continue;
      }
      console.error('[Ordonnance] Erreur service IA:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.error('[Ordonnance] Le service Medical AI doit écouter sur', MEDICAL_AI_URL, 'ou', MEDICAL_AI_FALLBACK);
      }
      return null;
    }
  }
  if (!successJson) return null;

  try {
    const json = successJson;
    const analyse = json.analyse || {};
    // Accepter medicaments dans analyse, en tableau direct, ou à la racine de la réponse
    let medicaments = Array.isArray(analyse.medicaments) ? analyse.medicaments : [];
    if (!medicaments.length && Array.isArray(json.medicaments)) medicaments = json.medicaments;
    if (!medicaments.length && Array.isArray(analyse)) medicaments = analyse;
    if (analyse.medicaments_extraits && Array.isArray(analyse.medicaments_extraits)) {
      const extraits = analyse.medicaments_extraits.map((m) => (typeof m === 'string' ? { nom: m, dosage: '', forme: 'comprime', frequence: '1', instructions: '', duree: '' } : m));
      if (extraits.length) medicaments = extraits;
    }
    medicaments = medicaments.map((m) => ({
      nom: typeof m === 'string' ? m : (m.nom || m.name || ''),
      dosage: typeof m === 'string' ? '' : (m.dosage || m.dose || ''),
      forme: typeof m === 'string' ? 'comprime' : (m.forme || m.form || 'comprime'),
      frequence: typeof m === 'string' ? '1' : (String(m.frequence || m.fois_par_jour || m.par_jour || '1').replace(/\s*fois.*/i, '').trim() || '1'),
      instructions: typeof m === 'string' ? '' : (m.instructions || m.mode_prise || ''),
      duree: typeof m === 'string' ? '' : (m.duree || m.duration || ''),
    })).filter((m) => m.nom);

    // Si l'IA n'a rien extrait mais on a du texte OCR, fallback : extraction depuis le texte brut
    const texteBrut = json.texte_ocr || (typeof analyse.analyse === 'string' ? analyse.analyse : '');
    if (medicaments.length === 0 && texteBrut) {
      const fallback = extraireMedicamentsDepuisTexte(texteBrut);
      if (fallback.length > 0) {
        medicaments = fallback;
        console.log('[Ordonnance] Extraction fallback depuis le texte OCR:', fallback.length, 'médicament(s)', fallback.map((m) => m.nom));
      } else {
        console.warn('[Ordonnance] Fallback: 0 médicament trouvé dans le texte OCR (', texteBrut.length, 'car.). Aperçu:', texteBrut.slice(0, 150));
      }
    }
    if (medicaments.length === 0) {
      console.warn('[Ordonnance] Aucun médicament extrait. Service IA sur port 3001 ? GEMINI_API_KEY dans medical-ai/.env ?');
    }

    const donnees_parsees = {
      medicaments,
      medecin: analyse.medecin || analyse.doctor || '',
      date_ordonnance: analyse.date_ordonnance || analyse.date || new Date().toISOString().split('T')[0],
      note: analyse.note || '',
    };
    return { texte_ocr: json.texte_ocr || '', donnees_parsees };
  } catch (err) {
    console.error('[Ordonnance] Erreur parsing réponse IA:', err.message);
    return null;
  }
}

/**
 * Scanner une ordonnance : envoi de l'image au service IA (medical-ai) pour OCR + extraction des médicaments.
 * Si MEDICAL_AI_URL n'est pas configuré ou le service échoue, données par défaut (à valider manuellement).
 */
const scanOrdonnance = async (patientId, file) => {
  if (!file) {
    const error = new Error('Aucun fichier fourni');
    error.statusCode = 400;
    throw error;
  }

  const imageUrl = `/uploads/${file.filename}`;
  const filePath = getFilePath(file);

  const ordonnance = await Ordonnance.create({
    patient_id: patientId,
    image_url: imageUrl,
    statut: 'en_cours',
    date_scan: new Date(),
  });

  let texteExtrait = '';
  let donneesParsees = { medicaments: [], medecin: '', date_ordonnance: new Date().toISOString().split('T')[0], note: '' };

  const resultatIA = await appelerServiceIA(filePath, file.originalname);
  if (resultatIA) {
    texteExtrait = resultatIA.texte_ocr;
    donneesParsees = resultatIA.donnees_parsees;
    if (donneesParsees.medicaments?.length > 0) {
      console.log('[Ordonnance] IA:', donneesParsees.medicaments.length, 'médicament(s) extrait(s)');
    }
  } else {
    texteExtrait = 'Analyse IA non disponible. Démarrez le service Medical AI (voir instructions sur cette page) puis glissez à nouveau l\'image pour rescanner.';
    donneesParsees.note = 'Service IA non démarré ou injoignable. Démarrez : cd IA_E-Sante/medical-ai puis node server.js (port 3001).';
    donneesParsees.raison_aucun_medicament = 'service_ia_indisponible';
  }

  await ordonnance.update({
    texte_extrait: texteExtrait,
    donnees_parsees: donneesParsees,
  });

  return ordonnance;
};

/**
 * Valider une ordonnance scannée et créer les traitements correspondants
 */
const validerOrdonnance = async (ordonnanceId, patientId, patient, corrections) => {
  const ordonnance = await Ordonnance.findOne({
    where: { id: ordonnanceId, patient_id: patientId },
  });

  if (!ordonnance) {
    const error = new Error('Ordonnance non trouvée');
    error.statusCode = 404;
    throw error;
  }

  if (ordonnance.statut === 'validee') {
    const error = new Error('Cette ordonnance a déjà été validée');
    error.statusCode = 400;
    throw error;
  }

  // Accepter body = { corrections: [...] } ou body = [...] (tableau)
  const correctionsList = (corrections && Array.isArray(corrections.corrections)) ? corrections.corrections : (Array.isArray(corrections) ? corrections : []);
  const medicaments = (correctionsList.length > 0)
    ? correctionsList
    : (ordonnance.donnees_parsees?.medicaments || []);

  // Créer les traitements pour chaque médicament (aucun si liste vide)
  const traitementsCrees = [];
  for (const med of medicaments) {
    const traitement = await traitementService.create(patientId, {
      nom_medicament: med.nom,
      dosage: med.dosage,
      forme: med.forme || 'comprime',
      frequence: med.frequence,
      instructions: med.instructions,
      date_debut: new Date(),
      date_fin: med.duree ? calculerDateFin(med.duree) : null,
    }, patient);

    traitementsCrees.push(traitement);
  }

  // Mettre à jour le statut de l'ordonnance
  await ordonnance.update({
    statut: 'validee',
    donnees_parsees: { ...ordonnance.donnees_parsees, medicaments },
  });

  return {
    ordonnance,
    traitements: traitementsCrees,
  };
};

/**
 * Récupérer les ordonnances d'un patient (format adapté pour l'affichage)
 * Uniquement les ordonnances du patient connecté.
 */
const getAll = async (patientId) => {
  if (!patientId) {
    return [];
  }
  const rows = await Ordonnance.findAll({
    where: { patient_id: patientId },
    order: [['date_scan', 'DESC']],
  });

  return rows.map((ordo) => {
    const medicaments = ordo.donnees_parsees?.medicaments || [];
    const medicaments_extraits = medicaments.map((m) => (typeof m === 'string' ? m : m.nom));

    return {
      id: ordo.id,
      patient_id: ordo.patient_id,
      image_url: ordo.image_url,
      statut: ordo.statut,
      date_scan: ordo.date_scan,
      created_at: ordo.createdAt || ordo.created_at,
      date: ordo.date_scan || ordo.createdAt || ordo.created_at,
      medicaments_extraits: medicaments_extraits.filter(Boolean),
      donnees_parsees: ordo.donnees_parsees,
    };
  });
};

// ==================== HELPERS ====================

/**
 * Calculer la date de fin à partir d'une durée textuelle
 */
const calculerDateFin = (duree) => {
  const match = duree.match(/(\d+)\s*(jour|semaine|mois)/i);
  if (!match) return null;

  const nombre = parseInt(match[1]);
  const unite = match[2].toLowerCase();
  const dateFin = new Date();

  if (unite.startsWith('jour')) dateFin.setDate(dateFin.getDate() + nombre);
  else if (unite.startsWith('semaine')) dateFin.setDate(dateFin.getDate() + nombre * 7);
  else if (unite.startsWith('mois')) dateFin.setMonth(dateFin.getMonth() + nombre);

  return dateFin;
};

module.exports = {
  scanOrdonnance,
  validerOrdonnance,
  getAll,
};
