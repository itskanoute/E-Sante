const nodemailer = require('nodemailer');

/**
 * Adresse "From" à utiliser. Gmail n'accepte que l'adresse du compte (ou un alias configuré),
 * donc on utilise SMTP_USER quand le serveur est Gmail.
 */
const getFromAddress = () => {
    const host = (process.env.SMTP_HOST || '').toLowerCase();
    if (host.includes('gmail') && process.env.SMTP_USER) {
        return `"E-Santé" <${process.env.SMTP_USER}>`;
    }
    return process.env.SMTP_FROM || '"E-Santé" <noreply@e-sante.com>';
};

/**
 * Créer le transporteur SMTP (config compatible Gmail et autres)
 */
const createTransporter = () => {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const host = (process.env.SMTP_HOST || '').toLowerCase();
    const isGmail = host.includes('gmail');

    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465,
    };

    if (port === 587 && isGmail) {
        config.requireTLS = true;
    }

    if (process.env.SMTP_USER) {
        config.auth = {
            user: process.env.SMTP_USER.trim(),
            pass: (process.env.SMTP_PASS || '').replace(/\s/g, ''), // enlever les espaces (mot de passe app Gmail)
        };
    }

    return nodemailer.createTransport(config);
};

const sendHtmlEmail = async ({ to, subject, html }) => {
    const mailOptions = {
        from: getFromAddress(),
        to,
        subject,
        html,
    };

    try {
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Email envoyé à ${to} (${subject})`);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error.message);
    }
};

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
const sendResetPasswordEmail = async (email, token) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🏥 E-Santé</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Votre santé, notre priorité</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #333; margin: 0 0 16px; font-size: 22px;">Réinitialisation de votre mot de passe</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            Vous avez demandé la réinitialisation de votre mot de passe. 
            Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
          </p>
          
          <!-- Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          
          <!-- Link fallback -->
          <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
          </p>
          <p style="color: #667eea; font-size: 13px; word-break: break-all; margin: 8px 0 0;">
            ${resetUrl}
          </p>
          
          <!-- Warning -->
          <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 16px; border-radius: 4px; margin: 24px 0 0;">
            <p style="color: #856404; font-size: 13px; margin: 0; line-height: 1.5;">
              ⚠️ Ce lien est valable pendant <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} E-Santé — Application d'observance thérapeutique
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    await sendHtmlEmail({
        to: email,
        subject: '🔐 Réinitialisation de votre mot de passe — E-Santé',
        html: htmlContent,
    });
};

const buildPriseEmailHeader = () => `
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">🏥 E-Santé</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 13px;">Rappel de prise de médicament</p>
  </div>
`;

const buildPriseEmailFooter = () => `
  <div style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
    <p style="color: #aaa; font-size: 11px; margin: 0;">
      © ${new Date().getFullYear()} E-Santé — Application d'observance thérapeutique
    </p>
  </div>
`;

const buildPriseEmailLayout = (content) => `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fa;">
    <div style="max-width:600px;margin:24px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.07);">
      ${buildPriseEmailHeader()}
      <div style="padding:28px 24px;">
        ${content}
      </div>
      ${buildPriseEmailFooter()}
    </div>
  </body>
</html>
`;

const sendPrisePreReminderEmail = async (to, patient, traitement, heurePrevue) => {
    const { nom, prenom } = patient;
    const { nom_medicament, dosage } = traitement;

    const content = `
      <h2 style="color:#333;margin:0 0 12px;font-size:20px;">Bientôt l'heure de votre prise</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Bonjour ${prenom || ''} ${nom || ''},<br/>
        Ceci est un rappel anticipé : dans <strong>5 minutes</strong>, il sera l'heure de prendre votre médicament.
      </p>
      <div style="background-color:#f5f7ff;border-radius:8px;padding:12px 16px;margin:0 0 16px;border:1px solid #e0e5ff;">
        <p style="color:#333;font-size:14px;margin:0;">
          <strong>Médicament :</strong> ${nom_medicament}${dosage ? ` — ${dosage}` : ''}
        </p>
        <p style="color:#333;font-size:14px;margin:4px 0 0;">
          <strong>Heure prévue :</strong> ${heurePrevue}
        </p>
      </div>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:0;">
        Vous pourrez ensuite confirmer la prise dans l'application E-Santé.
      </p>
    `;

    await sendHtmlEmail({
        to,
        subject: `Rappel anticipé — prise de ${nom_medicament}`,
        html: buildPriseEmailLayout(content),
    });
};

const sendPriseReminderEmail = async (to, patient, traitement, heurePrevue) => {
    const { nom, prenom } = patient;
    const { nom_medicament, dosage } = traitement;

    const content = `
      <h2 style="color:#333;margin:0 0 12px;font-size:20px;">C'est l'heure de votre prise</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Bonjour ${prenom || ''} ${nom || ''},<br/>
        Il est maintenant l'heure de prendre votre médicament.
      </p>
      <div style="background-color:#f5f7ff;border-radius:8px;padding:12px 16px;margin:0 0 16px;border:1px solid #e0e5ff;">
        <p style="color:#333;font-size:14px;margin:0;">
          <strong>Médicament :</strong> ${nom_medicament}${dosage ? ` — ${dosage}` : ''}
        </p>
        <p style="color:#333;font-size:14px;margin:4px 0 0;">
          <strong>Heure prévue :</strong> ${heurePrevue}
        </p>
      </div>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:0;">
        Pensez à <strong>confirmer la prise</strong> dans l'application E-Santé une fois le médicament pris.
      </p>
    `;

    await sendHtmlEmail({
        to,
        subject: `Rappel de prise — ${nom_medicament}`,
        html: buildPriseEmailLayout(content),
    });
};

const sendPriseRelanceEmail = async (to, patient, traitement, heurePrevue) => {
    const { nom, prenom } = patient;
    const { nom_medicament, dosage } = traitement;

    const content = `
      <h2 style="color:#333;margin:0 0 12px;font-size:20px;">Prise non confirmée</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Bonjour ${prenom || ''} ${nom || ''},<br/>
        Nous n'avons pas encore reçu la confirmation de la prise suivante :
      </p>
      <div style="background-color:#fff8e1;border-radius:8px;padding:12px 16px;margin:0 0 16px;border:1px solid #ffe082;">
        <p style="color:#333;font-size:14px;margin:0;">
          <strong>Médicament :</strong> ${nom_medicament}${dosage ? ` — ${dosage}` : ''}
        </p>
        <p style="color:#333;font-size:14px;margin:4px 0 0;">
          <strong>Heure prévue :</strong> ${heurePrevue}
        </p>
      </div>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:0 0 8px;">
        Si vous avez déjà pris ce médicament, merci de <strong>confirmer la prise</strong> dans l'application.
      </p>
      <p style="color:#777;font-size:12px;line-height:1.6;margin:0;">
        En cas de doute ou de difficultés, n'hésitez pas à contacter votre professionnel de santé.
      </p>
    `;

    await sendHtmlEmail({
        to,
        subject: `Relance — prise de ${nom_medicament} non confirmée`,
        html: buildPriseEmailLayout(content),
    });
};

module.exports = {
    sendResetPasswordEmail,
    sendPrisePreReminderEmail,
    sendPriseReminderEmail,
    sendPriseRelanceEmail,
};

