# Medical AI – Analyse d’ordonnances

Mini projet Node.js : upload d’une image d’ordonnance → OCR (Tesseract) → analyse structurée (Gemini API).

## Installation

```bash
cd medical-ai
npm init -y
npm install express multer tesseract.js dotenv
```

*(Optionnel : `npm install node-fetch` si Node &lt; 18. Le projet utilise le `fetch` natif.)*

## Configuration

1. Copier `.env` et renseigner ta clé Gemini :
   ```
   GEMINI_API_KEY=ta_cle_google_ai
   ```

2. Démarrer le serveur :
   ```bash
   npm start
   ```

Le serveur écoute sur **http://localhost:3000**.

## Utilisation

- **Formulaire web** : ouvrir http://localhost:3000 dans le navigateur, choisir une image, cliquer sur « Analyser ».
- **Postman** : `POST http://localhost:3000/analyze`, body **form-data**, champ **image** (type File) = ton fichier image.

Réponse : JSON avec `texte_ocr` (texte extrait) et `analyse` (médicaments, dosage, fréquence, etc.).
