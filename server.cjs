require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');

// Carga fetch compatible con ESM desde CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const upload = multer();
const port = 3000;

// Verifica que exista la API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ No se encontró GEMINI_API_KEY en el archivo .env");
  process.exit(1);
}

// ⚠️ Cambia el modelo para que coincida con el habilitado en tu API Key
const GEMINI_MODEL = "models/gemini-1.5-flash";


app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint para generar contenido con Gemini
app.post('/api/gemini', async (req, res) => {
  const prompt = req.body.prompt;
  console.log("📩 Prompt recibido:", prompt);

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    });

    console.log("✅ Código de estado:", response.status);

    const text = await response.text();
    console.log("📨 Respuesta cruda:", text);

    if (!response.ok) {
      console.error("❌ Error en respuesta HTTP:", text);
      return res.status(response.status).send("Error HTTP de Gemini: " + response.statusText);
    }

    const data = JSON.parse(text);
    if (!data || !data.candidates) {
      return res.status(500).send("❌ Gemini devolvió una respuesta vacía o sin candidatos.");
    }

    return res.json(data); // ✅ ¡Respuesta única aquí!

  } catch (error) {
    console.error("💥 Error al conectar con Gemini:", error);
    if (!res.headersSent) {
      return res.status(500).send("❌ Error al conectar con Gemini:\n" + error.message);
    }
  }
});


// Endpoint para extracción de texto desde PDF
app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  try {
    const data = await pdfParse(req.file.buffer);
    res.json({ text: data.text });
  } catch (err) {
    console.error("❌ Error al procesar PDF:", err.message);
    res.status(500).send("Error al procesar PDF: " + err.message);
  }
});

// Inicializar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor backend escuchando en: http://localhost:${port}`);
});
