import express from 'express';
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

const app = express();
app.use(express.json()); // Habilita el middleware para leer JSON

// Prefijo para las claves en la base de datos
const KEY_PREFIX = 'asignatura:';

// ----- ENDPOINTS DEL CRUD -----

/**
 * 📚 POST /asignaturas
 * Crea una nueva asignatura.
 */
app.post('/asignaturas', async (req, res) => {
  const { carrera, sem, cod, asig, uc, requisitos } = req.body;

  // Validación de datos de entrada
  if (!carrera || !sem || !cod || !asig || !uc) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (carrera, sem, cod, asig, uc).' });
  }

  const key = `${KEY_PREFIX}${cod}`;
  
  // Verificar si la asignatura ya existe
  const existing = await kv.exists(key);
  if (existing) {
    return res.status(409).json({ error: `La asignatura con el código ${cod} ya existe.` });
  }

  const newAsignatura = {
    id: nanoid(), // Generamos un ID único
    carrera,
    sem: parseInt(sem),
    cod,
    asig,
    uc: parseInt(uc),
    requisitos: requisitos || [] // Por si no se envían requisitos
  };

  await kv.set(key, newAsignatura);
  res.status(201).json(newAsignatura);
});

/**
 * 📖 GET /asignaturas
 * Obtiene todas las asignaturas.
 */
app.get('/asignaturas', async (req, res) => {
  const keys = [];
  for await (const key of kv.scanIterator({ match: `${KEY_PREFIX}*` })) {
    keys.push(key);
  }

  if (keys.length === 0) {
    return res.status(200).json([]);
  }

  const asignaturas = await kv.mget(...keys);
  res.status(200).json(asignaturas);
});

/**
 * 🏷️ GET /asignaturas/:cod
 * Obtiene una asignatura específica por su código.
 */
app.get('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${KEY_PREFIX}${cod}`;
  const asignatura = await kv.get(key);

  if (!asignatura) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }

  res.status(200).json(asignatura);
});

/**
 * ✏️ PUT /asignaturas/:cod
 * Actualiza una asignatura existente.
 */
app.put('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${KEY_PREFIX}${cod}`;

  const existingAsignatura = await kv.get(key);
  if (!existingAsignatura) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }

  // Fusionamos los datos existentes con los nuevos para permitir actualizaciones parciales
  const updatedAsignatura = { ...existingAsignatura, ...req.body };
  await kv.set(key, updatedAsignatura);

  res.status(200).json(updatedAsignatura);
});

/**
 * 🗑️ DELETE /asignaturas/:cod
 * Elimina una asignatura.
 */
app.delete('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${KEY_PREFIX}${cod}`;
  
  const result = await kv.del(key);

  if (result === 0) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }
  
  res.status(204).send(); // Éxito, sin contenido
});


// Exportamos la app para que Vercel la sirva
export default app;