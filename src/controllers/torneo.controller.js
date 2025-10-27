// src/controllers/torneo.controller.js
import { conexion } from "../config/database.js";
import {
  EVENTO_ID,
  DEPORTE_AJEDREZ_ID,
  obtenerFechaActual,
  calcularEstructuraTorneo,
  sortearEquipos,
  agruparEnfrentamientosPorFase,
  obtenerNombresJugadores,
  aplicarNombresJugadores,
  actualizarEnProgreso,
  actualizarAFinalizado,
  modificarResultado,
  crearEnfrentamientoNormal,
  crearEnfrentamientoBye,
  crearEnfrentamientoIndividualNormal,
  crearEnfrentamientoIndividualBye,
  actualizarEnfrentamientoIndividualEnProgreso,
  actualizarEnfrentamientoIndividualAFinalizado,
  modificarResultadoIndividual
} from "../utils/torneo.js";

// ============================================
// QUERIES SQL
// ============================================

const QUERIES = {
  equiposAjedrez: `
    SELECT
        j.id AS id_equipo,
        j.nombre AS nombre_equipo,
        d.nombre AS deporte,
        ci.nombre AS ciclo,
        i.cantidad_participantes,
        j.id AS representante_id,
        j.nombre AS representante_nombre,
        e.celular AS representante_telefono,
        v.fecha_validacion AS fecha_inscripcion,
        v.estado AS estado_inscripcion,
        'disponible' AS estado_sorteo
    FROM jugadores j
    JOIN equipo_jugador ej ON j.id = ej.jugador_id
    JOIN equipos e ON ej.equipo_id = e.id
    JOIN deportes d ON e.deporte_id = d.id
    JOIN ciclos ci ON e.ciclo_id = ci.id
    JOIN inscripciones i ON i.equipo_id = e.id
    JOIN vouchers v ON v.inscripcion_id = i.id
    WHERE i.evento_id = ? AND v.estado = 'validado' AND e.deporte_id = ?
  `,

  enfrentamientosAjedrez: `
    SELECT
        ei.id AS partido_id, 
        de.id as detalle_partido_id, 
        ei.partido_numero,
        f.id AS fase_id, 
        f.nombre AS fase_nombre, 
        f.orden AS fase_orden,
        j1.id AS equipo_1_id, 
        j1.nombre AS equipo_1_nombre, 
        c1.nombre AS equipo_1_ciclo,
        j2.id AS equipo_2_id, 
        j2.nombre AS equipo_2_nombre, 
        c2.nombre AS equipo_2_ciclo,
        CASE WHEN ei.jugador_2_id IS NULL THEN 1 ELSE 0 END AS es_bye,
        ep.estado, de.puntos_jugador_1 AS puntos_equipo_1, de.puntos_jugador_2 AS puntos_equipo_2, de.ganador_id
    FROM enfrentamientos_individual ei
    INNER JOIN detalle_enfrentamiento de ON de.enfrentamiento_id = ei.id
    INNER JOIN estados_partido ep ON de.estado_id = ep.id
    LEFT JOIN fases_evento f ON f.id = de.fase_id
    LEFT JOIN jugadores j1 ON j1.id = ei.jugador_1_id
    LEFT JOIN jugadores j2 ON j2.id = ei.jugador_2_id
    JOIN equipo_jugador ej1 ON j1.id = ej1.jugador_id
    JOIN equipo_jugador ej2 ON j2.id = ej2.jugador_id
    JOIN equipos eqi1 ON ej1.equipo_id = eqi1.id
    JOIN equipos eqi2 ON ej2.equipo_id = eqi2.id
    LEFT JOIN ciclos c1 ON eqi1.ciclo_id = c1.id
    LEFT JOIN ciclos c2 ON eqi2.ciclo_id = c2.id
    WHERE de.evento_id = ?
    ORDER BY f.orden, ei.partido_numero
  `,

  enfrentamientosGrupales: `
    SELECT
      enf.id AS partido_id, dp.id as detalle_partido_id, enf.partido_numero,
      f.id AS fase_id, f.nombre AS fase_nombre, f.orden AS fase_orden,
      e1.id AS equipo_1_id, e1.nombre AS equipo_1_nombre, c1.nombre AS equipo_1_ciclo,
      e2.id AS equipo_2_id, e2.nombre AS equipo_2_nombre, c2.nombre AS equipo_2_ciclo,
      CASE WHEN enf.equipo_2_id IS NULL THEN 1 ELSE 0 END AS es_bye,
      ep.estado, dp.puntos_equipo_1, dp.puntos_equipo_2, dp.ganador_id
    FROM enfrentamientos enf
    INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
    INNER JOIN estados_partido ep ON dp.estado_id = ep.id
    LEFT JOIN fases_evento f ON f.id = dp.fase_id
    LEFT JOIN equipos e1 ON e1.id = enf.equipo_1_id
    LEFT JOIN ciclos c1 ON c1.id = e1.ciclo_id
    LEFT JOIN equipos e2 ON e2.id = enf.equipo_2_id
    LEFT JOIN ciclos c2 ON c2.id = e2.ciclo_id
    WHERE dp.evento_id = ? AND e1.deporte_id = ?
    ORDER BY f.orden, enf.partido_numero
  `,

  equiposQueAvanzan: `
    SELECT
        dp.ganador_id AS equipo_id,
        enf.partido_numero
    FROM detalle_partido dp
    JOIN enfrentamientos enf ON dp.partido_id = enf.id
    JOIN equipos e ON dp.ganador_id = e.id
    WHERE dp.fase_id = ?
      AND dp.estado_id = 2
      AND dp.ganador_id IS NOT NULL
      AND e.deporte_id = ?
    ORDER BY enf.partido_numero ASC
  `,

  campeonInfo: `
    SELECT e.id, e.nombre, ci.nombre AS ciclo
    FROM equipos e
    INNER JOIN ciclos ci ON e.ciclo_id = ci.id
    WHERE e.id = ?
  `,

  jugadoresQueAvanzan: `
    SELECT
        de.ganador_id AS jugador_id,
        ei.partido_numero
    FROM detalle_enfrentamiento de
    JOIN enfrentamientos_individual ei ON de.enfrentamiento_id = ei.id
    JOIN jugadores j ON de.ganador_id = j.id
    WHERE de.fase_id = ?
      AND de.estado_id = 2
      AND de.ganador_id IS NOT NULL
    ORDER BY ei.partido_numero ASC
  `,

  campeonJugadorInfo: `
    SELECT j.id, j.nombre
    FROM jugadores j
    WHERE j.id = ?
  `
};

// ============================================
// OBTENER INFORMACIÓN DEL TORNEO
// ============================================

export const obtenerInformacionTorneo = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;
    const isChess = parseInt(deporteId, 10) === DEPORTE_AJEDREZ_ID;

    let equiposOriginal;
    let enfrentamientos;

    if (isChess) {
      [equiposOriginal] = await conn.query(QUERIES.equiposAjedrez, [EVENTO_ID, deporteId]);
      [enfrentamientos] = await conn.query(QUERIES.enfrentamientosAjedrez, [EVENTO_ID]);
    } else {
      const [equiposResult] = await conn.query('CALL mostrar_equipos_2(?, ?)', [EVENTO_ID, deporteId]);
      equiposOriginal = equiposResult[0] || [];
      [enfrentamientos] = await conn.query(QUERIES.enfrentamientosGrupales, [EVENTO_ID, deporteId]);
    }

    // Procesar datos
    const equiposLimpios = equiposOriginal.map(eq => ({
      id_equipo: eq.id_equipo,
      nombre_equipo: eq.nombre_equipo,
      deporte: eq.deporte,
      ciclo: eq.ciclo,
      estado_inscripcion: eq.estado_inscripcion,
      estado_sorteo: eq.estado_sorteo
    }));

    const rondas = agruparEnfrentamientosPorFase(enfrentamientos);

    // Calcular estadísticas
    const disponibles = equiposOriginal.filter(eq => eq.estado_sorteo === 'disponible').length;
    const asignados = equiposOriginal.length - disponibles;

    // Obtener información del deporte
    const [deporteInfo] = await conn.query('SELECT id, nombre FROM deportes WHERE id = ?', [deporteId]);

    res.json({
      deporte: {
        id: parseInt(deporteId),
        nombre: deporteInfo[0]?.nombre || 'N/A'
      },
      equipos: equiposLimpios,
      rondas: rondas,
      estadisticas: {
        total_equipos: equiposOriginal.length,
        equipos_disponibles: disponibles,
        equipos_asignados: asignados,
        total_partidos: enfrentamientos.length
      }
    });

  } catch (error) {
    console.error('Error al obtener información del torneo:', error.message);
    res.status(500).json({
      mensaje: 'Error al obtener información del torneo',
      error: error.message
    });
  } finally {
    conn.release();
  }
};

// ============================================
// GENERAR TORNEO
// ============================================

export const generarTorneo = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, equipos } = req.body;

    if (!equipos || equipos.length < 4) {
      return res.status(400).json({
        mensaje: `Se requieren al menos 4 equipos para generar un torneo. Equipos recibidos: ${equipos?.length || 0}`,
      });
    }

    await conn.beginTransaction();

    // Calcular estructura del torneo
    const estructura = calcularEstructuraTorneo(equipos.length);

    if (estructura.ordenFaseInicial < 0) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `El número de equipos (${equipos.length}) es demasiado grande para la estructura de fases actual.`
      });
    }

    // Obtener fase inicial
    const [fases] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden = ? LIMIT 1',
      [EVENTO_ID, estructura.ordenFaseInicial]
    );

    if (!fases.length) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `No se encontró una fase inicial con orden ${estructura.ordenFaseInicial}.`
      });
    }
    const { id: faseInicialId, nombre: faseInicialNombre } = fases[0];

    // Sorteo aleatorio
    const equiposAleatorios = sortearEquipos(equipos);
    const equiposConBye = equiposAleatorios.slice(0, estructura.numByes);
    const equiposQueJuegan = equiposAleatorios.slice(estructura.numByes);

    const partidosGenerados = [];
    let numeroPartido = 1;

    // Generar enfrentamientos normales
    for (let i = 0; i < estructura.numPartidosRonda1; i++) {
      const equipo1 = equiposQueJuegan[i * 2];
      const equipo2 = equiposQueJuegan[i * 2 + 1];

      const enfId = await crearEnfrentamientoNormal(
        conn, equipo1.id, equipo2.id, numeroPartido, EVENTO_ID, faseInicialId
      );

      partidosGenerados.push({
        enfrentamiento_id: enfId,
        partido_numero: numeroPartido,
        equipo_1: equipo1,
        equipo_2: equipo2,
        es_bye: false,
      });

      numeroPartido++;
    }

    // Generar enfrentamientos con bye
    for (const equipo of equiposConBye) {
      const enfId = await crearEnfrentamientoBye(
        conn, equipo.id, numeroPartido, EVENTO_ID, faseInicialId
      );

      partidosGenerados.push({
        enfrentamiento_id: enfId,
        partido_numero: numeroPartido,
        equipo_1: equipo,
        equipo_2: null,
        es_bye: true,
      });

      numeroPartido++;
    }

    // Obtener todas las fases del torneo
    const [fasesDelTorneo] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden >= ? ORDER BY orden',
      [EVENTO_ID, estructura.ordenFaseInicial]
    );

    await conn.commit();

    // Post-procesamiento para Ajedrez
    if (parseInt(deporteId, 10) === DEPORTE_AJEDREZ_ID) {
      const allPlayerTeamIds = equipos.map(p => p.id);
      const playerNamesMap = await obtenerNombresJugadores(conn, allPlayerTeamIds);
      aplicarNombresJugadores(partidosGenerados, playerNamesMap);
    }

    res.json({
      mensaje: 'Torneo generado exitosamente con estructura dinámica.',
      torneo: {
        deporteId: parseInt(deporteId),
        totalEquipos: equipos.length,
        totalRondas: estructura.totalRondas,
        faseInicial: {
          id: faseInicialId,
          nombre: faseInicialNombre,
          orden: estructura.ordenFaseInicial,
        },
        estructura: {
          bracket_size: estructura.bracketSize,
          equipos_juegan_fase_inicial: equiposQueJuegan.length,
          equipos_con_bye: estructura.numByes,
          partidos_fase_inicial: estructura.numPartidosRonda1,
        },
        rondas: fasesDelTorneo.map((f, index) => ({
          fase_id: f.id,
          nombre: f.nombre,
          orden: f.orden,
          partidos: index === 0 ? partidosGenerados.sort((a, b) => a.partido_numero - b.partido_numero) : [],
        })),
      },
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al generar torneo:', error.message);
    res.status(500).json({
      mensaje: 'Error al generar torneo',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

// ============================================
// AVANZAR RONDA
// ============================================

export const avanzarRonda = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, faseActualId } = req.body;

    if (!deporteId || !faseActualId) {
      return res.status(400).json({
        mensaje: 'Se requiere deporteId y faseActualId'
      });
    }

    await conn.beginTransaction();

    // Validar que todos los partidos estén finalizados
    const [pendientes] = await conn.query(`
      SELECT COUNT(dp.id) AS total
      FROM detalle_partido dp
      JOIN enfrentamientos enf ON dp.partido_id = enf.id
      JOIN equipos e ON enf.equipo_1_id = e.id
      WHERE dp.fase_id = ? AND e.deporte_id = ? AND dp.estado_id != 2
    `, [faseActualId, deporteId]);

    if (pendientes[0].total > 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'Aún hay partidos pendientes en la ronda actual.',
        partidos_pendientes: pendientes[0].total
      });
    }

    // Obtener equipos que avanzan
    const [equiposQueAvanzan] = await conn.query(QUERIES.equiposQueAvanzan, [faseActualId, deporteId]);

    if (equiposQueAvanzan.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay equipos ganadores o con bye en esta fase para avanzar.'
      });
    }

    // Verificar si hay un campeón
    if (equiposQueAvanzan.length === 1) {
      const campeonEquipoId = equiposQueAvanzan[0].equipo_id;
      const [campeonInfo] = await conn.query(QUERIES.campeonInfo, [campeonEquipoId]);
      let campeon = campeonInfo[0] || null;

      // Para Ajedrez, obtener nombre del jugador
      if (campeon && parseInt(deporteId, 10) === DEPORTE_AJEDREZ_ID) {
        const playerNamesMap = await obtenerNombresJugadores(conn, [campeonEquipoId]);
        if (playerNamesMap.has(campeonEquipoId)) {
          campeon.nombre = playerNamesMap.get(campeonEquipoId);
        }
      }

      await conn.commit();

      return res.json({
        mensaje: '¡Torneo finalizado! Campeón definido.',
        torneo_finalizado: true,
        campeon: campeon,
        fase_actual: { id: faseActualId }
      });
    }

    // Obtener la siguiente fase
    const [faseActual] = await conn.query('SELECT orden FROM fases_evento WHERE id = ?', [faseActualId]);

    const [siguienteFaseArr] = await conn.query(`
      SELECT id, nombre, orden FROM fases_evento
      WHERE evento_id = ? AND orden > ?
      ORDER BY orden ASC LIMIT 1
    `, [EVENTO_ID, faseActual[0].orden]);

    if (!siguienteFaseArr.length) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay una siguiente fase configurada.'
      });
    }
    const siguienteFase = siguienteFaseArr[0];

    // Crear nuevos enfrentamientos
    const partidosNuevos = [];
    let nuevoPartidoNumero = 1;

    for (let i = 0; i < equiposQueAvanzan.length; i += 2) {
      const equipo1 = equiposQueAvanzan[i];
      const equipo2 = equiposQueAvanzan[i + 1] || null;
      const esBye = equipo2 === null;

      let enfId;
      if (esBye) {
        enfId = await crearEnfrentamientoBye(conn, equipo1.equipo_id, nuevoPartidoNumero, EVENTO_ID, siguienteFase.id);
      } else {
        enfId = await crearEnfrentamientoNormal(conn, equipo1.equipo_id, equipo2.equipo_id, nuevoPartidoNumero, EVENTO_ID, siguienteFase.id);
      }

      partidosNuevos.push({
        enfrentamiento_id: enfId,
        partido_numero: nuevoPartidoNumero,
        equipo_1_id: equipo1.equipo_id,
        equipo_2_id: esBye ? null : equipo2.equipo_id,
        es_bye: esBye
      });

      nuevoPartidoNumero++;
    }

    await conn.commit();

    res.json({
      mensaje: 'Ronda avanzada exitosamente.',
      fase_anterior: { id: faseActualId, orden: faseActual[0].orden },
      siguiente_fase: { id: siguienteFase.id, nombre: siguienteFase.nombre, orden: siguienteFase.orden },
      partidos_nuevos: partidosNuevos,
      debug: { total_equipos_siguiente_fase: equiposQueAvanzan.length }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al avanzar ronda:', error.message);
    res.status(500).json({
      mensaje: 'Error al avanzar ronda',
      error: error.message
    });
  } finally {
    conn.release();
  }
};

// ============================================
// ELIMINAR TORNEO
// ============================================

export const eliminarTorneo = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;

    await conn.beginTransaction();

    await conn.query(`
      DELETE dp FROM detalle_partido dp
      INNER JOIN enfrentamientos enf ON dp.partido_id = enf.id
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE dp.evento_id = ? AND e.deporte_id = ?
    `, [EVENTO_ID, deporteId]);

    await conn.query(`
      DELETE enf FROM enfrentamientos enf
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE e.deporte_id = ?
    `, [deporteId]);

    await conn.commit();

    res.json({ mensaje: 'Torneo reiniciado exitosamente' });

  } catch (error) {
    await conn.rollback();
    console.error('Error al reiniciar torneo:', error.message);
    res.status(500).json({
      mensaje: 'Error al reiniciar torneo',
      error: error.message
    });
  } finally {
    conn.release();
  }
};

// ============================================
// ACTUALIZAR PARTIDO
// ============================================

export const actualizarPartido = async (req, res) => {
  const { detalle_partido_id } = req.params;
  const { estado, fase_id, puntos_equipo_1, puntos_equipo_2, ganador_id, perdedor_id } = req.body;

  if (!['en_progreso', 'finalizado', 'modificar'].includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado inválido' });
  }

  const fechaActual = obtenerFechaActual();

  try {
    if (estado === 'en_progreso') {
      if (fase_id === undefined) {
        return res.status(400).json({ mensaje: 'Fase ID requerido' });
      }
      await actualizarEnProgreso(detalle_partido_id, fase_id, fechaActual);
      return res.status(200).json({ mensaje: 'Partido actualizado a en progreso' });
    }

    if (estado === 'finalizado') {
      if (fase_id === undefined || puntos_equipo_1 === undefined ||
          puntos_equipo_2 === undefined || ganador_id === undefined) {
        return res.status(400).json({ mensaje: 'Faltan datos para finalizar el partido' });
      }
      await actualizarAFinalizado(detalle_partido_id, fase_id, fechaActual, puntos_equipo_1, puntos_equipo_2, ganador_id, perdedor_id);
      return res.status(200).json({ mensaje: 'Partido finalizado correctamente' });
    }

    if (estado === 'modificar') {
      if (puntos_equipo_1 === undefined || puntos_equipo_2 === undefined || ganador_id === undefined) {
        return res.status(400).json({ mensaje: 'Faltan datos para modificar el resultado' });
      }
      await modificarResultado(detalle_partido_id, puntos_equipo_1, puntos_equipo_2, ganador_id);
      return res.status(200).json({ mensaje: 'Resultado modificado correctamente' });
    }

  } catch (e) {
    console.error('❌ Error al actualizar el enfrentamiento:', e.message);
    return res.status(500).json({
      mensaje: 'Error al actualizar el enfrentamiento',
      error: e.message
    });
  }
};

// ============================================
// TORNEO INDIVIDUAL
// ============================================

/**
 * POST /api/admin/torneo/generar-individual
 * Genera torneo individual (por jugador) con estructura dinámica y sorteo aleatorio.
 * Similar a generarTorneo pero usa las tablas enfrentamientos_individual y detalle_enfrentamiento.
 */
export const generarTorneoIndividual = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, jugadores } = req.body;

    if (!jugadores || jugadores.length < 4) {
      return res.status(400).json({
        mensaje: `Se requieren al menos 4 jugadores para generar un torneo. Jugadores recibidos: ${jugadores?.length || 0}`,
      });
    }

    await conn.beginTransaction();

    // Calcular estructura del torneo
    const estructura = calcularEstructuraTorneo(jugadores.length);

    if (estructura.ordenFaseInicial < 0) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `El número de jugadores (${jugadores.length}) es demasiado grande para la estructura de fases actual.`
      });
    }

    // Obtener fase inicial
    const [fases] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden = ? LIMIT 1',
      [EVENTO_ID, estructura.ordenFaseInicial]
    );

    if (!fases.length) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `No se encontró una fase inicial con orden ${estructura.ordenFaseInicial}.`
      });
    }
    const { id: faseInicialId, nombre: faseInicialNombre } = fases[0];

    // Sorteo aleatorio
    const jugadoresAleatorios = sortearEquipos(jugadores); // Reutilizamos la función de sorteo
    const jugadoresConBye = jugadoresAleatorios.slice(0, estructura.numByes);
    const jugadoresQueJuegan = jugadoresAleatorios.slice(estructura.numByes);

    const enfrentamientosGenerados = [];
    let numeroPartido = 1;

    // Generar enfrentamientos normales
    for (let i = 0; i < estructura.numPartidosRonda1; i++) {
      const jugador1 = jugadoresQueJuegan[i * 2];
      const jugador2 = jugadoresQueJuegan[i * 2 + 1];

      const enfId = await crearEnfrentamientoIndividualNormal(
        conn, jugador1.id, jugador2.id, numeroPartido, EVENTO_ID, faseInicialId
      );

      enfrentamientosGenerados.push({
        enfrentamiento_id: enfId,
        partido_numero: numeroPartido,
        jugador_1: jugador1,
        jugador_2: jugador2,
        es_bye: false,
      });

      numeroPartido++;
    }

    // Generar enfrentamientos con bye
    for (const jugador of jugadoresConBye) {
      const enfId = await crearEnfrentamientoIndividualBye(
        conn, jugador.id, numeroPartido, EVENTO_ID, faseInicialId
      );

      enfrentamientosGenerados.push({
        enfrentamiento_id: enfId,
        partido_numero: numeroPartido,
        jugador_1: jugador,
        jugador_2: null,
        es_bye: true,
      });

      numeroPartido++;
    }

    // Obtener todas las fases del torneo
    const [fasesDelTorneo] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden >= ? ORDER BY orden',
      [EVENTO_ID, estructura.ordenFaseInicial]
    );

    await conn.commit();

    res.json({
      mensaje: 'Torneo individual generado exitosamente con estructura dinámica.',
      torneo: {
        deporteId: parseInt(deporteId),
        totalJugadores: jugadores.length,
        totalRondas: estructura.totalRondas,
        faseInicial: {
          id: faseInicialId,
          nombre: faseInicialNombre,
          orden: estructura.ordenFaseInicial,
        },
        estructura: {
          bracket_size: estructura.bracketSize,
          jugadores_juegan_fase_inicial: jugadoresQueJuegan.length,
          jugadores_con_bye: estructura.numByes,
          partidos_fase_inicial: estructura.numPartidosRonda1,
        },
        rondas: fasesDelTorneo.map((f, index) => ({
          fase_id: f.id,
          nombre: f.nombre,
          orden: f.orden,
          enfrentamientos: index === 0 ? enfrentamientosGenerados.sort((a, b) => a.partido_numero - b.partido_numero) : [],
        })),
      },
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al generar torneo individual:', error.message);
    res.status(500).json({
      mensaje: 'Error al generar torneo individual',
      error: error.message,
    });
  } finally {
    conn.release();
  }
};

/**
 * PATCH /api/admin/torneo/enfrentamientos-individual/:detalle_enfrentamiento_id
 * Actualiza el estado y resultado de un enfrentamiento individual.
 */
export const actualizarEnfrentamientoIndividual = async (req, res) => {
  const { detalle_enfrentamiento_id } = req.params;
  const { estado, fase_id, puntos_jugador_1, puntos_jugador_2, ganador_id, perdedor_id } = req.body;

  if (!['en_progreso', 'finalizado', 'modificar'].includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado inválido' });
  }

  const fechaActual = obtenerFechaActual();

  try {
    if (estado === 'en_progreso') {
      if (fase_id === undefined) {
        return res.status(400).json({ mensaje: 'Fase ID requerido' });
      }
      await actualizarEnfrentamientoIndividualEnProgreso(detalle_enfrentamiento_id, fase_id, fechaActual);
      return res.status(200).json({ mensaje: 'Enfrentamiento actualizado a en progreso' });
    }

    if (estado === 'finalizado') {
      if (fase_id === undefined || puntos_jugador_1 === undefined ||
          puntos_jugador_2 === undefined || ganador_id === undefined) {
        return res.status(400).json({ mensaje: 'Faltan datos para finalizar el enfrentamiento' });
      }
      await actualizarEnfrentamientoIndividualAFinalizado(
        detalle_enfrentamiento_id, fase_id, fechaActual,
        puntos_jugador_1, puntos_jugador_2, ganador_id, perdedor_id
      );
      return res.status(200).json({ mensaje: 'Enfrentamiento finalizado correctamente' });
    }

    if (estado === 'modificar') {
      if (puntos_jugador_1 === undefined || puntos_jugador_2 === undefined || ganador_id === undefined) {
        return res.status(400).json({ mensaje: 'Faltan datos para modificar el resultado' });
      }
      await modificarResultadoIndividual(detalle_enfrentamiento_id, puntos_jugador_1, puntos_jugador_2, ganador_id);
      return res.status(200).json({ mensaje: 'Resultado modificado correctamente' });
    }

  } catch (e) {
    console.error('❌ Error al actualizar el enfrentamiento individual:', e.message);
    return res.status(500).json({
      mensaje: 'Error al actualizar el enfrentamiento individual',
      error: e.message
    });
  }
};

/**
 * DELETE /api/admin/torneo/individual/:deporteId
 * Elimina todos los enfrentamientos individuales de un torneo
 */
export const eliminarTorneoIndividual = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;

    await conn.beginTransaction();

    // Eliminar detalles de enfrentamiento primero (FK constraint)
    await conn.query(`
      DELETE de FROM detalle_enfrentamiento de
      INNER JOIN enfrentamientos_individual ei ON de.enfrentamiento_id = ei.id
      WHERE de.evento_id = ?
    `, [EVENTO_ID]);

    // Eliminar enfrentamientos individuales
    await conn.query(`
      DELETE FROM enfrentamientos_individual
      WHERE id NOT IN (
        SELECT DISTINCT enfrentamiento_id
        FROM detalle_enfrentamiento
      )
    `);

    await conn.commit();

    res.json({
      mensaje: 'Torneo individual reiniciado exitosamente'
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al reiniciar torneo individual:', error.message);
    res.status(500).json({
      mensaje: 'Error al reiniciar torneo individual',
      error: error.message
    });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/admin/torneo/avanzar-ronda-individual
 * Avanza automáticamente a la siguiente ronda en torneos individuales, manteniendo la lógica del bracket.
 */
export const avanzarRondaIndividual = async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { faseActualId } = req.body;

    if (!faseActualId) {
      return res.status(400).json({
        mensaje: 'Se requiere faseActualId'
      });
    }

    await conn.beginTransaction();

    // Validar que todos los enfrentamientos de la fase estén finalizados
    const [pendientes] = await conn.query(`
      SELECT COUNT(de.id) AS total
      FROM detalle_enfrentamiento de
      WHERE de.fase_id = ?
        AND de.estado_id != 2
    `, [faseActualId]);

    if (pendientes[0].total > 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'Aún hay enfrentamientos pendientes en la ronda actual.',
        enfrentamientos_pendientes: pendientes[0].total
      });
    }

    // Obtener jugadores que avanzan
    const [jugadoresQueAvanzan] = await conn.query(QUERIES.jugadoresQueAvanzan, [faseActualId]);

    if (jugadoresQueAvanzan.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay jugadores ganadores o con bye en esta fase para avanzar.'
      });
    }

    // Verificar si ya hay un campeón
    if (jugadoresQueAvanzan.length === 1) {
      const campeonJugadorId = jugadoresQueAvanzan[0].jugador_id;
      const [campeonInfo] = await conn.query(QUERIES.campeonJugadorInfo, [campeonJugadorId]);
      const campeon = campeonInfo[0] || null;

      await conn.commit();

      return res.json({
        mensaje: '¡Torneo finalizado! Campeón definido.',
        torneo_finalizado: true,
        campeon: campeon,
        fase_actual: { id: faseActualId }
      });
    }

    // Obtener la siguiente fase
    const [faseActual] = await conn.query('SELECT orden FROM fases_evento WHERE id = ?', [faseActualId]);

    const [siguienteFaseArr] = await conn.query(`
      SELECT id, nombre, orden FROM fases_evento
      WHERE evento_id = ? AND orden > ?
      ORDER BY orden ASC LIMIT 1
    `, [EVENTO_ID, faseActual[0].orden]);

    if (!siguienteFaseArr.length) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay una siguiente fase configurada.'
      });
    }
    const siguienteFase = siguienteFaseArr[0];

    // Crear nuevos enfrentamientos
    const enfrentamientosNuevos = [];
    let nuevoPartidoNumero = 1;

    for (let i = 0; i < jugadoresQueAvanzan.length; i += 2) {
      const jugador1 = jugadoresQueAvanzan[i];
      const jugador2 = jugadoresQueAvanzan[i + 1] || null;
      const esBye = jugador2 === null;

      let enfId;
      if (esBye) {
        enfId = await crearEnfrentamientoIndividualBye(conn, jugador1.jugador_id, nuevoPartidoNumero, EVENTO_ID, siguienteFase.id);
      } else {
        enfId = await crearEnfrentamientoIndividualNormal(conn, jugador1.jugador_id, jugador2.jugador_id, nuevoPartidoNumero, EVENTO_ID, siguienteFase.id);
      }

      enfrentamientosNuevos.push({
        enfrentamiento_id: enfId,
        partido_numero: nuevoPartidoNumero,
        jugador_1_id: jugador1.jugador_id,
        jugador_2_id: esBye ? null : jugador2.jugador_id,
        es_bye: esBye
      });

      nuevoPartidoNumero++;
    }

    await conn.commit();

    res.json({
      mensaje: 'Ronda avanzada exitosamente en torneo individual.',
      fase_anterior: { id: faseActualId, orden: faseActual[0].orden },
      siguiente_fase: { id: siguienteFase.id, nombre: siguienteFase.nombre, orden: siguienteFase.orden },
      enfrentamientos_nuevos: enfrentamientosNuevos,
      debug: { total_jugadores_siguiente_fase: jugadoresQueAvanzan.length }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al avanzar ronda individual:', error.message);
    res.status(500).json({
      mensaje: 'Error al avanzar ronda individual',
      error: error.message
    });
  } finally {
    conn.release();
  }
};
