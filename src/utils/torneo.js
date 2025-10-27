// src/utils/torneo.js
import { query } from "../config/database.js";

export const EVENTO_ID = 2; // Semana Sistemica Deportes 2025
export const DEPORTE_AJEDREZ_ID = 4;

export const ESTADOS = {
  PENDIENTE: 1,
  FINALIZADO: 2,
  EN_PROGRESO: 5,
};

/**
 * Obtiene la fecha actual formateada para MySQL
 */
export const obtenerFechaActual = () => {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
};

/**
 * Calcula la estructura del torneo basado en el numero de equipos
 */
export const calcularEstructuraTorneo = (numEquipos) => {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(numEquipos)));
  const totalRondas = Math.log2(bracketSize);
  const numByes = bracketSize - numEquipos;
  const numEquiposEnRonda1 = numEquipos - numByes;
  const numPartidosRonda1 = numEquiposEnRonda1 / 2;
  const ordenFaseInicial = 4 - (totalRondas - 1);

  return {
    bracketSize,
    totalRondas,
    numByes,
    numEquiposEnRonda1,
    numPartidosRonda1,
    ordenFaseInicial
  };
};

/**
 * Realiza sorteo aleatorio de equipos
 */
export const sortearEquipos = (equipos) => {
  return [...equipos].sort(() => Math.random() - 0.5);
};

/**
 * Agrupa enfrentamientos por fase/ronda
 */
export const agruparEnfrentamientosPorFase = (enfrentamientos) => {
  const rondasMap = new Map();

  for (const enf of enfrentamientos) {
    if (!rondasMap.has(enf.fase_id)) {
      rondasMap.set(enf.fase_id, {
        fase_id: enf.fase_id,
        nombre: enf.fase_nombre,
        orden: enf.fase_orden,
        partidos: []
      });
    }

    rondasMap.get(enf.fase_id).partidos.push({
      partido_id: enf.partido_id,
      detalle_partido_id: enf.detalle_partido_id,
      numero: enf.partido_numero,
      equipo_1: enf.equipo_1_id ? {
        id: enf.equipo_1_id,
        nombre: enf.equipo_1_nombre,
        ciclo: enf.equipo_1_ciclo
      } : null,
      equipo_2: enf.equipo_2_id ? {
        id: enf.equipo_2_id,
        nombre: enf.equipo_2_nombre,
        ciclo: enf.equipo_2_ciclo
      } : null,
      es_bye: Boolean(enf.es_bye),
      estado: enf.estado,
      resultado: {
        puntos_equipo_1: enf.puntos_equipo_1,
        puntos_equipo_2: enf.puntos_equipo_2
      },
      ganador_id: enf.ganador_id
    });
  }

  return Array.from(rondasMap.values()).sort((a, b) => a.orden - b.orden);
};

/**
 * Obtiene los nombres de jugadores para equipos de ajedrez
 */
export const obtenerNombresJugadores = async (conn, equipoIds) => {
  if (equipoIds.length === 0) return new Map();

  const [playerNames] = await conn.query(`
    SELECT e.id AS equipo_id, j.nombre
    FROM equipos e
    JOIN equipo_jugador ej ON e.id = ej.equipo_id
    JOIN jugadores j ON ej.jugador_id = j.id
    WHERE e.id IN (?)
  `, [equipoIds]);

  return new Map(playerNames.map(p => [p.equipo_id, p.nombre]));
};

/**
 * Aplica nombres de jugadores a los equipos (para ajedrez)
 */
export const aplicarNombresJugadores = (partidos, playerNamesMap) => {
  partidos.forEach(partido => {
    if (partido.equipo_1 && playerNamesMap.has(partido.equipo_1.id)) {
      partido.equipo_1.nombre = playerNamesMap.get(partido.equipo_1.id);
    }
    if (partido.equipo_2 && playerNamesMap.has(partido.equipo_2.id)) {
      partido.equipo_2.nombre = playerNamesMap.get(partido.equipo_2.id);
    }
  });
};

/**
 * Calcula el puntaje segun el tipo de equipo y fase
 */
export const calcularPuntaje = (tipoPago, esFaseFinal, esGanador) => {
  if (tipoPago === 'adicional') return 0;

  if (esFaseFinal) {
    return esGanador ? 50 : 30;
  }

  return 0;
};

/**
 * Actualiza el partido a estado "en_progreso"
 */
export const actualizarEnProgreso = async (id, fase_id, fecha_inicio) => {
  await query(
    `UPDATE detalle_partido SET estado_id = ?, fase_id = ?, fecha_inicio = ? WHERE id = ?`,
    [ESTADOS.EN_PROGRESO, fase_id, fecha_inicio, id]
  );
};

/**
 * Actualiza el partido a estado "finalizado" y registra el historial
 */
export const actualizarAFinalizado = async (id, fase_id, fecha_fin, puntos1, puntos2, ganador_id, perdedor_id) => {
  if (!ganador_id || !perdedor_id) {
    throw new Error("Ganador y perdedor ID son requeridos para registrar el historial del partido");
  }

  // Verificar si el equipo es regular o adicional
  const queryTipoPago = `SELECT tipo_pago FROM inscripciones WHERE equipo_id = ?`;
  const [ganadorPago] = await query(queryTipoPago, [ganador_id]);
  const [perdedorPago] = await query(queryTipoPago, [perdedor_id]);

  const esFaseFinal = fase_id === 4;

  const puntajeGanador = calcularPuntaje(ganadorPago?.tipo_pago, esFaseFinal, true);
  const puntajePerdedor = calcularPuntaje(perdedorPago?.tipo_pago, esFaseFinal, false);

  // Actualiza el detalle del partido
  const actualizarDetalle = query(
    `UPDATE detalle_partido SET
      estado_id = ?,
      fase_id = ?,
      fecha_termino = ?,
      puntos_equipo_1 = ?,
      puntos_equipo_2 = ?,
      ganador_id = ?
    WHERE id = ?`,
    [ESTADOS.FINALIZADO, fase_id, fecha_fin, puntos1, puntos2, ganador_id, id]
  );

  // Insertar historial para el ganador
  const insertarGanador = query(
    `INSERT INTO historial_partido_equipo
      (equipo_id, partido_id, resultado, puntos, fecha_registro)
    VALUES (?, ?, ?, ?, ?)`,
    [ganador_id, id, 'ganado', puntajeGanador, fecha_fin]
  );

  // Insertar historial para el perdedor
  const insertarPerdedor = query(
    `INSERT INTO historial_partido_equipo
      (equipo_id, partido_id, resultado, puntos, fecha_registro)
    VALUES (?, ?, ?, ?, ?)`,
    [perdedor_id, id, 'perdido', puntajePerdedor, fecha_fin]
  );

  // Ejecutar todas las operaciones en paralelo
  await Promise.all([actualizarDetalle, insertarGanador, insertarPerdedor]);
};

/**
 * Modifica los puntajes del partido sin cambiar el estado
 */
export const modificarResultado = async (id, puntos1, puntos2, ganador_id) => {
  await query(
    `UPDATE detalle_partido SET
      puntos_equipo_1 = ?,
      puntos_equipo_2 = ?,
      ganador_id = ?
    WHERE id = ?`,
    [puntos1, puntos2, ganador_id, id]
  );
};

/**
 * Crea un enfrentamiento normal (con dos equipos)
 */
export const crearEnfrentamientoNormal = async (conn, equipo1Id, equipo2Id, numeroPartido, eventoId, faseId) => {
  const [enfResult] = await conn.query(
    'INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero) VALUES (?, ?, ?)',
    [equipo1Id, equipo2Id, numeroPartido]
  );

  await conn.query(
    'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id) VALUES (?, 1, ?, ?)',
    [enfResult.insertId, eventoId, faseId]
  );

  return enfResult.insertId;
};

/**
 * Crea un enfrentamiento con BYE (equipo avanza automaticamente)
 */
export const crearEnfrentamientoBye = async (conn, equipoId, numeroPartido, eventoId, faseId) => {
  const [enfResult] = await conn.query(
    'INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero) VALUES (?, NULL, ?)',
    [equipoId, numeroPartido]
  );

  await conn.query(
    'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id, ganador_id) VALUES (?, 2, ?, ?, ?)',
    [enfResult.insertId, eventoId, faseId, equipoId]
  );

  return enfResult.insertId;
};

// ============================================
// FUNCIONES PARA ENFRENTAMIENTOS INDIVIDUALES
// ============================================

/**
 * Crea un enfrentamiento individual normal (con dos jugadores)
 */
export const crearEnfrentamientoIndividualNormal = async (conn, jugador1Id, jugador2Id, numeroPartido, eventoId, faseId) => {
  const [enfResult] = await conn.query(
    'INSERT INTO enfrentamientos_individual (jugador_1_id, jugador_2_id, partido_numero) VALUES (?, ?, ?)',
    [jugador1Id, jugador2Id, numeroPartido]
  );

  await conn.query(
    'INSERT INTO detalle_enfrentamiento (enfrentamiento_id, estado_id, evento_id, fase_id) VALUES (?, 1, ?, ?)',
    [enfResult.insertId, eventoId, faseId]
  );

  return enfResult.insertId;
};

/**
 * Crea un enfrentamiento individual con BYE (jugador avanza automáticamente)
 */
export const crearEnfrentamientoIndividualBye = async (conn, jugadorId, numeroPartido, eventoId, faseId) => {
  const [enfResult] = await conn.query(
    'INSERT INTO enfrentamientos_individual (jugador_1_id, jugador_2_id, partido_numero) VALUES (?, NULL, ?)',
    [jugadorId, numeroPartido]
  );

  await conn.query(
    'INSERT INTO detalle_enfrentamiento (enfrentamiento_id, estado_id, evento_id, fase_id, ganador_id) VALUES (?, 2, ?, ?, ?)',
    [enfResult.insertId, eventoId, faseId, jugadorId]
  );

  return enfResult.insertId;
};

/**
 * Actualiza el enfrentamiento individual a estado "en_progreso"
 */
export const actualizarEnfrentamientoIndividualEnProgreso = async (id, fase_id, fecha_inicio) => {
  await query(
    `UPDATE detalle_enfrentamiento SET estado_id = ?, fase_id = ?, fecha_inicio = ? WHERE id = ?`,
    [ESTADOS.EN_PROGRESO, fase_id, fecha_inicio, id]
  );
};

/**
 * Actualiza el enfrentamiento individual a estado "finalizado" y registra el historial
 */
export const actualizarEnfrentamientoIndividualAFinalizado = async (id, fase_id, fecha_fin, puntos1, puntos2, ganador_id, perdedor_id) => {
  if (!ganador_id || !perdedor_id) {
    throw new Error("Ganador y perdedor ID son requeridos para registrar el historial del enfrentamiento");
  }

  // 1. Obtener el enfrentamiento_id desde detalle_enfrentamiento
  const queryEnfrentamientoId = `SELECT enfrentamiento_id FROM detalle_enfrentamiento WHERE id = ?`;
  const [detalleResult] = await query(queryEnfrentamientoId, [id]);

  if (!detalleResult || !detalleResult.enfrentamiento_id) {
    throw new Error(`No se encontró el detalle de enfrentamiento con ID ${id}`);
  }

  const enfrentamientoId = detalleResult.enfrentamiento_id;

  // 2. Verificar si el jugador es de equipo regular o adicional
  const queryTipoPago = `
    SELECT i.tipo_pago
    FROM jugadores j
    JOIN equipo_jugador ej ON j.id = ej.jugador_id
    JOIN inscripciones i ON i.equipo_id = ej.equipo_id
    WHERE j.id = ?
    LIMIT 1
  `;
  const [ganadorPago] = await query(queryTipoPago, [ganador_id]);
  const [perdedorPago] = await query(queryTipoPago, [perdedor_id]);

  const esFaseFinal = fase_id === 4;

  const puntajeGanador = calcularPuntaje(ganadorPago?.tipo_pago, esFaseFinal, true);
  const puntajePerdedor = calcularPuntaje(perdedorPago?.tipo_pago, esFaseFinal, false);

  // 3. Actualiza el detalle del enfrentamiento
  const actualizarDetalle = query(
    `UPDATE detalle_enfrentamiento SET
      estado_id = ?,
      fase_id = ?,
      fecha_termino = ?,
      puntos_jugador_1 = ?,
      puntos_jugador_2 = ?,
      ganador_id = ?
    WHERE id = ?`,
    [ESTADOS.FINALIZADO, fase_id, fecha_fin, puntos1, puntos2, ganador_id, id]
  );

  // 4. Insertar historial para el ganador (usando enfrentamiento_id correcto)
  const insertarGanador = query(
    `INSERT INTO historial_enfrentamientos
      (jugador_id, enfrentamiento_id, resultado, puntos, fecha_registro)
    VALUES (?, ?, ?, ?, ?)`,
    [ganador_id, enfrentamientoId, 'ganado', puntajeGanador, fecha_fin]
  );

  // 5. Insertar historial para el perdedor (usando enfrentamiento_id correcto)
  const insertarPerdedor = query(
    `INSERT INTO historial_enfrentamientos
      (jugador_id, enfrentamiento_id, resultado, puntos, fecha_registro)
    VALUES (?, ?, ?, ?, ?)`,
    [perdedor_id, enfrentamientoId, 'perdido', puntajePerdedor, fecha_fin]
  );

  // 6. Ejecutar todas las operaciones en paralelo
  await Promise.all([actualizarDetalle, insertarGanador, insertarPerdedor]);
};

/**
 * Modifica los puntajes del enfrentamiento individual sin cambiar el estado
 */
export const modificarResultadoIndividual = async (id, puntos1, puntos2, ganador_id) => {
  await query(
    `UPDATE detalle_enfrentamiento SET
      puntos_jugador_1 = ?,
      puntos_jugador_2 = ?,
      ganador_id = ?
    WHERE id = ?`,
    [puntos1, puntos2, ganador_id, id]
  );
};
