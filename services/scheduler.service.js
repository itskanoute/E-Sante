const { Op } = require('sequelize');
const { PriseProgrammee, Traitement, Patient, HistoriquePrise } = require('../models');
const { STATUT_TRAITEMENT, STATUT_PRISE, JOURS_SEMAINE } = require('../utils/constants');
const { timeToMinutes, minutesToTime, startOfDay, endOfDay } = require('../utils/helpers');
const {
  sendPrisePreReminderEmail,
  sendPriseReminderEmail,
  sendPriseRelanceEmail,
} = require('./email.service');
const {
  envoyerRappelAnticipe,
  envoyerRappelPrise,
  envoyerRelanceOubli,
} = require('./notification.service');

const RELANCE_DELAY_MINUTES = 15;

const medLabel = (t) => [t.nom_medicament, t.dosage].filter(Boolean).join(' — ') || t.nom_medicament;

const getCurrentJourSemaine = () => {
  const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
  const jour = formatter.format(new Date()).toLowerCase();
  if (!JOURS_SEMAINE.includes(jour)) {
    return null;
  }
  return jour;
};

const buildTodayTraitementInclude = (today) => ({
  model: Traitement,
  as: 'traitement',
  where: {
    statut: STATUT_TRAITEMENT.ACTIF,
    date_debut: { [Op.lte]: today },
    [Op.or]: [
      { date_fin: null },
      { date_fin: { [Op.gte]: today } },
    ],
  },
  include: [
    {
      model: Patient,
      as: 'patient',
    },
  ],
});

const findPrisesForTime = async (targetTimeStr) => {
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const jourSemaine = getCurrentJourSemaine();

  const whereJour = jourSemaine
    ? {
        [Op.or]: [
          { jour_semaine: null },
          { jour_semaine: jourSemaine },
        ],
      }
    : {};

  // MySQL renvoie souvent TIME en "HH:MM:SS", on accepte les deux formats
  const heureMatch = [targetTimeStr];
  if (targetTimeStr.length === 5) heureMatch.push(targetTimeStr + ':00');

  return PriseProgrammee.findAll({
    where: {
      heure_prise: { [Op.or]: heureMatch },
      ...whereJour,
    },
    include: [buildTodayTraitementInclude(todayDateOnly)],
  });
};

const hasHistoriqueForToday = async (priseProgrammeeId, patientId) => {
  const today = new Date();
  const debut = startOfDay(today);
  const fin = endOfDay(today);

  const count = await HistoriquePrise.count({
    where: {
      prise_programmee_id: priseProgrammeeId,
      patient_id: patientId,
      date_heure_prevue: { [Op.between]: [debut, fin] },
    },
  });

  return count > 0;
};

const shouldSendEmail = (patient, { anticiper = false, relance = false }) => {
  const prefs = patient.preferences_notification || {};

  if (prefs.email === false) {
    return false;
  }

  if (anticiper && prefs.rappel_anticipe === false) {
    return false;
  }

  if (relance && prefs.relance_oubli === false) {
    return false;
  }

  return true;
};

const shouldSendNotification = (patient, { anticiper = false, relance = false }) => {
  const prefs = patient.preferences_notification || {};
  if (prefs.push === false) return false;
  if (anticiper && prefs.rappel_anticipe === false) return false;
  if (relance && prefs.relance_oubli === false) return false;
  return true;
};

const processPreReminders = async () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = currentMinutes + 5;
  const targetTimeStr = minutesToTime(targetMinutes);

  const prises = await findPrisesForTime(targetTimeStr);

  for (const prise of prises) {
    const traitement = prise.traitement;
    const patient = traitement?.patient;
    if (!traitement || !patient) continue;

    const hasHist = await hasHistoriqueForToday(prise.id, patient.id);
    if (hasHist) continue;

    if (shouldSendEmail(patient, { anticiper: true })) {
      await sendPrisePreReminderEmail(
        patient.email,
        { nom: patient.nom, prenom: patient.prenom },
        { nom_medicament: traitement.nom_medicament, dosage: traitement.dosage },
        targetTimeStr,
      );
    }
    if (shouldSendNotification(patient, { anticiper: true })) {
      await envoyerRappelAnticipe(patient.id, medLabel(traitement), targetTimeStr);
    }
  }
};

const processOnTimeReminders = async () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetTimeStr = minutesToTime(currentMinutes);

  const prises = await findPrisesForTime(targetTimeStr);

  for (const prise of prises) {
    const traitement = prise.traitement;
    const patient = traitement?.patient;
    if (!traitement || !patient) continue;

    const hasHist = await hasHistoriqueForToday(prise.id, patient.id);
    if (hasHist) continue;

    if (shouldSendEmail(patient, {})) {
      await sendPriseReminderEmail(
        patient.email,
        { nom: patient.nom, prenom: patient.prenom },
        { nom_medicament: traitement.nom_medicament, dosage: traitement.dosage },
        targetTimeStr,
      );
    }
    if (shouldSendNotification(patient, {})) {
      await envoyerRappelPrise(patient.id, medLabel(traitement), targetTimeStr);
    }
  }
};

const processRelances = async () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = currentMinutes - RELANCE_DELAY_MINUTES;
  if (targetMinutes < 0) {
    return;
  }

  const targetTimeStr = minutesToTime(targetMinutes);

  const prises = await findPrisesForTime(targetTimeStr);

  for (const prise of prises) {
    const traitement = prise.traitement;
    const patient = traitement?.patient;
    if (!traitement || !patient) continue;

    const hasHist = await hasHistoriqueForToday(prise.id, patient.id);
    if (hasHist) continue;

    if (shouldSendEmail(patient, { relance: true })) {
      await sendPriseRelanceEmail(
        patient.email,
        { nom: patient.nom, prenom: patient.prenom },
        { nom_medicament: traitement.nom_medicament, dosage: traitement.dosage },
        targetTimeStr,
      );
    }
    if (shouldSendNotification(patient, { relance: true })) {
      await envoyerRelanceOubli(patient.id, medLabel(traitement));
    }
  }
};

const startPriseReminderScheduler = () => {
  console.log('Démarrage du scheduler de rappels de prises (emails + notifications)...');

  const runTick = async () => {
    try {
      await Promise.all([
        processPreReminders(),
        processOnTimeReminders(),
        processRelances(),
      ]);
    } catch (error) {
      console.error('Erreur dans le scheduler de prises:', error);
    }
  };

  runTick();
  setInterval(runTick, 60 * 1000);
};

module.exports = {
  startPriseReminderScheduler,
};

