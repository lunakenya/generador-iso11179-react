import { marked } from 'marked';
import { useState, useRef } from 'react';
import './App.css';
import { diffWords } from 'diff';
import { jsPDF } from 'jspdf';

function App() {
  const [casoIA, setCasoIA] = useState('');
  const [analisisHumano, setAnalisisHumano] = useState('');
  const [auditoriaIA, setAuditoriaIA] = useState('');
  const [comparacionFinal, setComparacionFinal] = useState('');
  const [loading, setLoading] = useState(false);
  const resultadoRef = useRef();

  const llamarGemini = async (prompt) => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '⚠️ No se generó contenido válido.';
    } catch (error) {
      console.error("❌ Error en llamarGemini:", error.message);
      return `❌ Error al conectar con el servidor: ${error.message}`;
    }
  };

  const generarCaso = async () => {
    setLoading(true);
    const prompt = `
      Genera un caso de estudio educativo sobre *Gestión de Metadatos y Datos Maestros* siguiendo esta estructura en formato Markdown:

      **Título del caso:** Nombre del caso creado por la IA

      1. **Introducción:** Explica brevemente la importancia del tema.
      2. **Objetivo:** Qué busca lograr la empresa.
      3. **Contexto:** Describe el entorno o situación del caso (empresa, problema, entorno).
      4. **Herramientas y Tecnologías Usadas:** Menciona tecnologías utilizadas.
      5. **Implementación según ISO/IEC 11179:** Explica cómo se aplicó la norma ISO/IEC 11179.

      Hazlo en máximo 4 párrafos. Sé claro, preciso y educativo.
    `;
    const respuesta = await llamarGemini(prompt);
    setCasoIA(respuesta);
    setLoading(false);
  };

  const subirPDF = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor sube un archivo PDF válido.');
      return;
    }
    const formData = new FormData();
    formData.append('pdf', file);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setCasoIA(data.text);
    } catch (err) {
      alert('❌ Error al procesar el PDF: ' + err.message);
    }
  };

  const guardarAnalisis = () => {
    if (!analisisHumano.trim()) {
      alert('⚠️ Por favor ingresa tu análisis primero.');
      return;
    }
    alert('✅ Análisis humano guardado.');
  };

  const generarAuditoria = async () => {
    if (!casoIA) {
      alert('⚠️ Primero debes generar un caso de estudio con IA o subir uno.');
      return;
    }
    const prompt = `
      Realiza una auditoría técnica breve (máx. 5 párrafos) sobre el siguiente caso de estudio generado por IA relacionado con la Gestión de Metadatos y Datos Maestros bajo la norma ISO/IEC 11179. 
      Evalúa la claridad, estructura, aplicación normativa y propuesta tecnológica.
      Usa formato Markdown en la respuesta. 
      ❗ No incluyas calificaciones numéricas ni justificación de nota.

      Caso de estudio generado por IA:
      ${casoIA}
    `;
    const respuesta = await llamarGemini(prompt);
    setAuditoriaIA(respuesta);
  };

  const compararResultados = async () => {
    if (!analisisHumano || !casoIA) {
      alert("⚠️ Debes generar un caso de estudio y guardar tu análisis humano antes de comparar.");
      return;
    }

    const prompt = `
    Compara brevemente (máx. 3 párrafos) este análisis humano con el caso generado por IA, ambos sobre metadatos y datos maestros bajo la norma ISO/IEC 11179.
    Evalúa claridad, profundidad y cumplimiento. Luego, da una calificación del 0 al 10 a cada uno y explica por qué.

    Formato sugerido:
    - Análisis humano: nota /10
    - Análisis IA: nota /10
    - Justificación breve
    - ¿Cuál análisis es mejor y por qué?

    Análisis humano:
    ${analisisHumano}

    Caso de estudio generado por IA:
    ${casoIA}
    `;

    const respuesta = await llamarGemini(prompt);
    const comparacionHTML = marked.parse(respuesta);

    const diff = diffWords(analisisHumano, casoIA);
    const total = diff.length;
    const diferencias = diff.filter(part => part.added || part.removed).length;
    const porcentaje = Math.round((1 - diferencias / total) * 100);

    const matches = respuesta.match(/Análisis humano[^\"]*(\d{1,2})\/10.*Análisis IA[^\"]*(\d{1,2})\/10/i);

    let resumen = '';
    let coincidenciaTexto = `
      <p><strong>Porcentaje de diferencia y coincidencia entre el análisis humano y la IA:</strong></p>
      <div class="calificacion-container">
        <p><strong>📊 Coincidencia:</strong> ${porcentaje}%</p>
        <p><strong>📉 Diferencia:</strong> ${100 - porcentaje}%</p>
      </div>
    `;

    if (matches) {
      const notaHumano = parseInt(matches[1]);
      const notaIA = parseInt(matches[2]);
      let mejor = "🤝 Empate entre ambos análisis.";
      if (notaHumano > notaIA) mejor = "✅ El análisis humano tiene mejor calificación.";
      else if (notaIA > notaHumano) mejor = "✅ El análisis de la IA tiene mejor calificación.";

      resumen = `
        <div class="calificacion-container">
          <p><strong>Calificación Humano:</strong> ${notaHumano}/10</p>
          <p><strong>Calificación IA:</strong> ${notaIA}/10</p>
          <p><strong>${mejor}</strong></p>
        </div>
      `;
    }

    const insertAfter = comparacionHTML.includes('¿Cuál análisis es mejor y por qué?')
      ? comparacionHTML.replace('¿Cuál análisis es mejor y por qué?', `<strong>¿Cuál análisis es mejor y por qué?</strong>\n\n${coincidenciaTexto}`)
      : comparacionHTML + coincidenciaTexto;

    setComparacionFinal(`
      <h3>Comparación Final:</h3>
      <div class="justificado">${insertAfter}</div>
      ${resumen}
    `);
  };

const descargarPDF = () => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 50;
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const limpiarContenido = (texto) => {
    return texto
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, '')
      .replace(/[\u0080-\uFFFF]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  const agregarSeccion = (tituloPlano, contenido) => {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(tituloPlano, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 30;

    const textoPlano = limpiarContenido(contenido);
    const parrafos = textoPlano.split(/\n+/);

    parrafos.forEach((parrafo) => {
      const texto = parrafo.trim();
      if (!texto) return;

      if (/^(\d+\.\s.+?:|Análisis humano:|Análisis IA:|Justificación breve:|¿Cuál análisis.+|Porcentaje.+):?$/i.test(texto)) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(texto, margin, y, { maxWidth: usableWidth });
        y += 18;
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        const lineas = doc.splitTextToSize(texto, usableWidth);
        doc.text(lineas, margin, y, { align: 'justify', maxWidth: usableWidth });
        y += lineas.length * 15 + 8;
      }

      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = margin;
      }
    });

    y += 20;
  };

  if (casoIA) agregarSeccion('Caso de Estudio Generado por IA', casoIA);
  if (auditoriaIA) agregarSeccion('Auditoría Técnica IA', auditoriaIA);
  if (comparacionFinal) agregarSeccion('Comparación Final', comparacionFinal);

  doc.save('informe_auditoria_IA.pdf');
};


  return (
    <div className="app-container">
      <h1>📄 Generador de Casos ISO/IEC 11179 + Auditoría con IA</h1>

      <h3>🧠 ¿Cómo quieres cargar el caso de estudio?</h3>
      <div className="botones-generacion">
        <button onClick={generarCaso} disabled={loading}>
          {loading ? 'Generando...' : '🎲 Generar con IA'}
        </button>
        <label className="custom-file-upload">
          <input type="file" accept="application/pdf" onChange={subirPDF} />
          📄 Subir PDF
        </label>
      </div>

      <div ref={resultadoRef}>
        {casoIA && (
          <div className="resultado">
            <h3><strong>Caso Presentado:</strong></h3>
            <div dangerouslySetInnerHTML={{ __html: marked.parse(casoIA) }} />
          </div>
        )}

        <h2 style={{ fontSize: '1.2rem' }}>📝 Tu análisis respecto al caso presentado (tipo auditoría)</h2>
        <textarea
          placeholder="Escribe tu análisis aquí..."
          value={analisisHumano}
          onChange={(e) => setAnalisisHumano(e.target.value)}
        ></textarea>
        <button onClick={guardarAnalisis}>📥 Enviar Análisis Humano</button>

        <button onClick={generarAuditoria}>🤖 Generar Auditoría con IA</button>
        {auditoriaIA && (
          <div className="resultado">
            <h3 style={{ fontSize: '1rem', marginTop: '20px' }}><strong>Auditoría IA:</strong></h3>
            <div dangerouslySetInnerHTML={{ __html: marked.parse(auditoriaIA) }} />
          </div>
        )}

        <button onClick={compararResultados}>⚖️ Comparar Resultados</button>
        {comparacionFinal && (
          <div className="resultado" dangerouslySetInnerHTML={{ __html: comparacionFinal }} />
        )}
      </div>

      <button onClick={descargarPDF}>📥 Descargar Informe en PDF</button>
    </div>
  );
}

export default App;
