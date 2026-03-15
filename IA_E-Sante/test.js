const API_KEY = process.env.API_KEY || '';
const message = process.argv.slice(2).join(' ') || 'Bonjour';

async function testGemini() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
        }),
      }
    );
    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur API:', data?.error?.message || response.status, data);
      return;
    }
    if (data?.error) {
      console.error('Erreur:', data.error.message || data.error);
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(text ?? 'Réponse vide ou erreur');
  } catch (err) {
    console.error(err.message);
  }
}

testGemini();
