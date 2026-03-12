const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      if (process.env.NODE_ENV === 'development') {
        console.warn('Validation échouée:', error.details.map((d) => ({ path: d.path.join('.'), message: d.message })));
      }
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors,
      });
    }

    next();
  };
};

// ==================== SCHEMAS DE VALIDATION ====================

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': 'L\'email est requis',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    'any.required': 'Le mot de passe est requis',
  }),
  nom: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Le nom est requis',
  }),
  prenom: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Le prénom est requis',
  }),
  date_naissance: Joi.date().iso().optional(),
  telephone: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': 'L\'email est requis',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Le mot de passe est requis',
  }),
});

const updateProfileSchema = Joi.object({
  nom: Joi.string().min(2).max(100).optional(),
  prenom: Joi.string().min(2).max(100).optional(),
  date_naissance: Joi.date().iso().optional(),
  telephone: Joi.string().optional(),
  contact_urgence: Joi.string().optional(),
  allergies: Joi.array().items(Joi.string()).optional(),
  pathologies: Joi.array().items(Joi.string()).optional(),
  preferences_notification: Joi.object().optional(),
});

const parametresVieSchema = Joi.object({
  heure_reveil: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
    'string.pattern.base': 'Format heure invalide (HH:MM)',
  }),
  heure_coucher: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().messages({
    'string.pattern.base': 'Format heure invalide (HH:MM)',
  }),
  horaires_repas: Joi.object({
    petit_dejeuner: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    dejeuner: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    diner: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  }).optional(),
});

// Formes acceptées (avec "gélule" pour le front, normalisé en "gelule" dans le service)
const FORMES_VALIDES = ['comprime', 'gelule', 'gélule', 'sirop', 'injection', 'patch', 'gouttes', 'pommade', 'suppositoire', 'inhalateur', 'autre'];
const traitementSchema = Joi.object({
  nom_medicament: Joi.string().min(1).required().messages({
    'any.required': 'Le nom du médicament est requis',
    'string.min': 'Le nom du médicament est requis',
  }),
  dosage: Joi.string().allow('').optional(),
  forme: Joi.string().trim().lowercase().valid(...FORMES_VALIDES).optional().allow(''),
  frequence: Joi.string().allow('').optional(),
  instructions: Joi.string().allow('').optional(),
  // Champs date : accepter chaîne vide (input non rempli) en plus de date ISO
  date_debut: Joi.alternatives().try(Joi.date().iso(), Joi.valid('')).optional(),
  date_fin: Joi.alternatives().try(Joi.date().iso(), Joi.valid('')).optional(),
  // Accepter HH:MM, H:MM ou HH:MM:SS (secondes ignorées côté service)
  horaires_prise: Joi.array()
    .items(
      Joi.string().pattern(/^(0?[0-9]|1[0-9]|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/).messages({
        'string.pattern.base': 'Format horaire invalide (ex: 08:00 ou 8:00)',
      })
    )
    .optional(),
});

const confirmerPriseSchema = Joi.object({
  statut: Joi.string().valid('pris', 'oublie', 'reporte').required().messages({
    'any.required': 'Le statut est requis',
    'any.only': 'Statut invalide (pris, oublie, reporte)',
  }),
  date_heure_reelle: Joi.date().iso().optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': "L'email est requis",
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Le token est requis',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    'any.required': 'Le mot de passe est requis',
  }),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  parametresVieSchema,
  traitementSchema,
  confirmerPriseSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
