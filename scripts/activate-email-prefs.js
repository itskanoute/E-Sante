/**
 * Active les rappels par email pour tous les patients existants.
 * À lancer une fois après avoir mis email: true par défaut dans le modèle Patient.
 * Usage: node scripts/activate-email-prefs.js
 */

const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);
require('dotenv').config();

const { Patient, sequelize } = require('../models');

async function run() {
  const patients = await Patient.findAll();
  let updated = 0;
  for (const p of patients) {
    const prefs = { ...(p.preferences_notification || {}), email: true };
    if (prefs.email !== p.preferences_notification?.email) {
      p.preferences_notification = prefs;
      await p.save({ fields: ['preferences_notification'] });
      updated++;
    }
  }
  console.log(`Rappels email activés pour ${updated} patient(s). Total: ${patients.length}.`);
  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
