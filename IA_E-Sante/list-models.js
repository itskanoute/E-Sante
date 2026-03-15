const API_KEY = process.env.API_KEY || '';

async function listModels() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    const data = await response.json();
    if (data?.error) {
      console.error('Erreur:', data.error.message);
      return;
    }
    const models = data?.models || [];
    console.log('Modèles disponibles pour generateContent:\n');
    models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .forEach((m) => console.log('  ', m.name.replace('models/', '')));
  } catch (err) {
    console.error(err.message);
  }
}

listModels();
