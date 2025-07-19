import express from 'express';
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

const app = express();
app.use(express.json());

// Constantes para las claves
const ASIGNATURA_PREFIX = 'asignatura:';
const ASIGNATURAS_INDEX_KEY = 'index:asignaturas'; // Nuestro nuevo índice

// ----- ENDPOINTS DEL CRUD (VERSIÓN MEJORADA) -----

/**
 * 📚 POST /asignaturas
 * Crea una nueva asignatura y la añade al índice.
 */
app.post('/asignaturas', async (req, res) => {
  const { carrera, sem, cod, asig, uc, requisitos } = req.body;

  if (!carrera || !sem || !cod || !asig || !uc) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  const key = `${ASIGNATURA_PREFIX}${cod}`;
  
  const existing = await kv.exists(key);
  if (existing) {
    return res.status(409).json({ error: `La asignatura con el código ${cod} ya existe.` });
  }

  const newAsignatura = {
    id: nanoid(),
    carrera,
    sem: parseInt(sem),
    cod,
    asig,
    uc: parseInt(uc),
    requisitos: requisitos || []
  };

  // Usamos una transacción para asegurar que ambas operaciones se completen
  const multi = kv.multi();
  multi.set(key, newAsignatura);
  multi.sadd(ASIGNATURAS_INDEX_KEY, key); // Añadimos la clave al índice (Set)
  await multi.exec();

  res.status(201).json(newAsignatura);
});

/**
 * 📖 GET /asignaturas
 * Obtiene todas las asignaturas usando el índice (MÉTODO RÁPIDO).
 */
app.get('/asignaturas', async (req, res) => {
  // 1. Obtenemos todas las claves de nuestro índice (esto es muy rápido)
  const keys = await kv.smembers(ASIGNATURAS_INDEX_KEY);

  if (!keys || keys.length === 0) {
    return res.status(200).json([]);
  }

  // 2. Usamos mget para traer todos los objetos de una sola vez
  const asignaturas = await kv.mget(...keys);
  res.status(200).json(asignaturas);
});

/**
 * 🏷️ GET /asignaturas/:cod
 * Obtiene una asignatura específica (sin cambios).
 */
app.get('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${ASIGNATURA_PREFIX}${cod}`;
  const asignatura = await kv.get(key);

  if (!asignatura) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }

  res.status(200).json(asignatura);
});

/**
 * ✏️ PUT /asignaturas/:cod
 * Actualiza una asignatura (sin cambios en la lógica del índice).
 */
app.put('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${ASIGNATURA_PREFIX}${cod}`;

  const existingAsignatura = await kv.get(key);
  if (!existingAsignatura) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }

  const updatedAsignatura = { ...existingAsignatura, ...req.body };
  await kv.set(key, updatedAsignatura);

  res.status(200).json(updatedAsignatura);
});

/**
 * 🗑️ DELETE /asignaturas/:cod
 * Elimina una asignatura y la quita del índice.
 */
app.delete('/asignaturas/:cod', async (req, res) => {
  const { cod } = req.params;
  const key = `${ASIGNATURA_PREFIX}${cod}`;
  
  // Usamos una transacción para asegurar que ambas operaciones se completen
  const multi = kv.multi();
  multi.del(key);
  multi.srem(ASIGNATURAS_INDEX_KEY, key); // Quitamos la clave del índice
  const [delResult] = await multi.exec();

  if (delResult === 0) {
    return res.status(404).json({ error: 'Asignatura no encontrada.' });
  }
  
  res.status(204).send();
});

export default app;