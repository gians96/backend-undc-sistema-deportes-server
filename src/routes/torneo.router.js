// src/routes/torneo.router.js
import { Router } from "express";
import {
  obtenerInformacionTorneo,
  generarTorneo,
  avanzarRonda,
  eliminarTorneo,
  actualizarPartido,
  generarTorneoIndividual,
  actualizarEnfrentamientoIndividual,
  avanzarRondaIndividual,
  eliminarTorneoIndividual
} from "../controllers/torneo.controller.js";

const torneo = Router();

/**
 * GET /api/admin/torneo/:deporteId
 * Endpoint unificado que devuelve equipos + enfrentamientos + estadísticas.
 * Maneja el caso especial de Ajedrez (deporteId 4) para mostrar jugadores individuales.
 */
torneo.get("/:deporteId", obtenerInformacionTorneo);

/**
 * POST /api/admin/torneo/generar
 * Genera todo el torneo con una estructura dinámica y sorteo aleatorio.
 * Admite de 4 equipos en adelante.
 */
torneo.post("/generar", generarTorneo);

/**
 * POST /api/admin/torneo/avanzar-ronda
 * Avanza automáticamente a la siguiente ronda, manteniendo la lógica del bracket.
 */
torneo.post("/avanzar-ronda", avanzarRonda);

/**
 * DELETE /api/admin/torneo/:deporteId
 * Elimina todos los enfrentamientos de un torneo
 */
torneo.delete("/:deporteId", eliminarTorneo);

/**
 * PATCH /api/admin/torneo/enfrentamientos/:detalle_partido_id/partido
 * Actualiza el estado y resultado de un partido específico.
 */
torneo.patch('/enfrentamientos/:detalle_partido_id/partido', actualizarPartido);

/**
 * POST /api/admin/torneo/generar-individual
 * Genera torneo individual (por jugador) con estructura dinámica y sorteo aleatorio.
 * Para deportes individuales como ajedrez.
 */
torneo.post("/generar-individual", generarTorneoIndividual);

/**
 * PATCH /api/admin/torneo/enfrentamientos-individual/:detalle_enfrentamiento_id
 * Actualiza el estado y resultado de un enfrentamiento individual.
 */
torneo.patch('/enfrentamientos-individual/:detalle_enfrentamiento_id', actualizarEnfrentamientoIndividual);

/**
 * POST /api/admin/torneo/avanzar-ronda-individual
 * Avanza automáticamente a la siguiente ronda en torneos individuales.
 */
torneo.post("/avanzar-ronda-individual", avanzarRondaIndividual);

/**
 * DELETE /api/admin/torneo/individual/:deporteId
 * Elimina todos los enfrentamientos individuales de un torneo
 */
torneo.delete("/individual/:deporteId", eliminarTorneoIndividual);

export default torneo;
