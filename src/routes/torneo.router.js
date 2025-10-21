// src/routes/torneo.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const torneo = Router();

// La estructura del torneo ahora se calcula dinámicamente en el endpoint POST /generar.

/**
 * GET /api/admin/torneo/:deporteId
 * Endpoint unificado que devuelve equipos + enfrentamientos + estadísticas.
 * Maneja el caso especial de Ajedrez (deporteId 4) para mostrar jugadores individuales.
 */
torneo.get("/:deporteId", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;
    const eventoId = 2; // Semana Sistémica Deportes 2025
    const isChess = parseInt(deporteId, 10) === 4;

    let equiposOriginal;
    let enfrentamientos;

    if (isChess) {
      // --- Lógica para Ajedrez ---
      // 1. Obtener la lista de JUGADORES
      [equiposOriginal] = await conn.query(`
        SELECT
            e.id AS id_equipo,
            j.nombre AS nombre_equipo,
            d.nombre AS deporte,
            ci.nombre AS ciclo,
            i.cantidad_participantes,
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
      `, [eventoId, deporteId]);

      // 2. Obtener los enfrentamientos con nombres de JUGADORES
      [enfrentamientos] = await conn.query(`
        SELECT
            enf.id AS partido_id, dp.id as detalle_partido_id, enf.partido_numero,
            f.id AS fase_id, f.nombre AS fase_nombre, f.orden AS fase_orden,
            e1.id AS equipo_1_id, j1.nombre AS equipo_1_nombre, c1.nombre AS equipo_1_ciclo,
            e2.id AS equipo_2_id, j2.nombre AS equipo_2_nombre, c2.nombre AS equipo_2_ciclo,
            CASE WHEN enf.equipo_2_id IS NULL THEN 1 ELSE 0 END AS es_bye,
            ep.estado, dp.puntos_equipo_1, dp.puntos_equipo_2, dp.ganador_id
        FROM enfrentamientos enf
        INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
        INNER JOIN estados_partido ep ON dp.estado_id = ep.id
        LEFT JOIN fases_evento f ON f.id = dp.fase_id
        LEFT JOIN equipos e1 ON e1.id = enf.equipo_1_id
        LEFT JOIN equipo_jugador ej1 ON e1.id = ej1.equipo_id
        LEFT JOIN jugadores j1 ON ej1.jugador_id = j1.id
        LEFT JOIN ciclos c1 ON c1.id = e1.ciclo_id
        LEFT JOIN equipos e2 ON e2.id = enf.equipo_2_id
        LEFT JOIN equipo_jugador ej2 ON e2.id = ej2.equipo_id
        LEFT JOIN jugadores j2 ON ej2.jugador_id = j2.id
        LEFT JOIN ciclos c2 ON c2.id = e2.ciclo_id
        WHERE dp.evento_id = ? AND e1.deporte_id = ?
        ORDER BY f.orden, enf.partido_numero
      `, [eventoId, deporteId]);

    } else {
      // --- Lógica para deportes grupales ---
      // 1. Obtener equipos usando el SP existente
      const [equiposResult] = await conn.query('CALL mostrar_equipos_2(?, ?)', [eventoId, deporteId]);
      equiposOriginal = equiposResult[0] || [];

      // 2. Obtener todos los enfrentamientos con su estado y fase
      [enfrentamientos] = await conn.query(`
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
      `, [eventoId, deporteId]);
    }

    // 3. Procesar y estructurar datos (Lógica común)
    const equiposLimpios = equiposOriginal.map(eq => ({
      id_equipo: eq.id_equipo,
      nombre_equipo: eq.nombre_equipo,
      deporte: eq.deporte,
      ciclo: eq.ciclo,
      cantidad_participantes: eq.cantidad_participantes,
      representante_nombre: eq.representante_nombre,
      representante_telefono: eq.representante_telefono,
      fecha_inscripcion: eq.fecha_inscripcion,
      estado_inscripcion: eq.estado_inscripcion,
      estado_sorteo: eq.estado_sorteo
    }));

    // Agrupar partidos por ronda (fase)
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
        estado: enf.estado, // ej: 'pendiente', 'jugado'
        resultado: {
          puntos_equipo_1: enf.puntos_equipo_1,
          puntos_equipo_2: enf.puntos_equipo_2
        },
        ganador_id: enf.ganador_id
      });
    }

    const rondas = Array.from(rondasMap.values()).sort((a, b) => a.orden - b.orden);

    // 4. Calcular estadísticas
    const disponibles = equiposOriginal.filter(eq => eq.estado_sorteo === 'disponible').length;
    const asignados = equiposOriginal.length - disponibles;

    // 5. Obtener información del deporte
    const [deporteInfo] = await conn.query(
      'SELECT id, nombre FROM deportes WHERE id = ?',
      [deporteId]
    );

    // 6. Enviar respuesta estructurada
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
});

/**
 * POST /api/admin/torneo/generar
 * Genera todo el torneo con una estructura dinámica y sorteo aleatorio.
 * Admite de 4 equipos en adelante.
 */
torneo.post("/generar", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, equipos } = req.body;
    const eventoId = 2; // Semana Sistémica Deportes 2025

    // 1. Validar cantidad de equipos
    if (!equipos || equipos.length < 4) {
      return res.status(400).json({
        mensaje: `Se requieren al menos 4 equipos para generar un torneo. Equipos recibidos: ${equipos?.length || 0}`,
      });
    }

    await conn.beginTransaction();

    // 2. Calcular estructura dinámica del torneo
    const numEquipos = equipos.length;
    // Calcula el tamaño del bracket (la siguiente potencia de 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numEquipos)));
    const totalRondas = Math.log2(bracketSize);
    const numByes = bracketSize - numEquipos; // Equipos que pasan directo
    const numEquiposEnRonda1 = numEquipos - numByes;
    const numPartidosRonda1 = numEquiposEnRonda1 / 2;

    // 3. Determinar fase inicial
    // Fases por defecto: Final(4), Semifinal(3), Cuartos(2), Octavos(1), Ronda 1(0)
    // El orden se calcula para que la última ronda sea la Final (orden 4)
    const ordenFaseInicial = 4 - (totalRondas - 1);

    if (ordenFaseInicial < 0) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `El número de equipos (${numEquipos}) es demasiado grande para la estructura de fases actual. Se necesitan más fases en la base de datos.`
      });
    }

    const [fases] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden = ? LIMIT 1',
      [eventoId, ordenFaseInicial]
    );

    if (!fases.length) {
      await conn.rollback();
      return res.status(500).json({
        mensaje: `No se encontró una fase inicial con orden ${ordenFaseInicial} para el evento ${eventoId}.`
      });
    }
    const { id: faseInicialId, nombre: faseInicialNombre } = fases[0];

    // 4. Sorteo aleatorio y asignación de byes
    const equiposAleatorios = [...equipos].sort(() => Math.random() - 0.5);
    // Los equipos con bye son los primeros en la lista aleatoria
    const equiposConBye = equiposAleatorios.slice(0, numByes);
    // El resto de equipos juegan la primera ronda
    const equiposQueJuegan = equiposAleatorios.slice(numByes);

    const partidosGenerados = [];
    let numeroPartido = 1;

    // 5. Generar enfrentamientos para equipos que juegan
    for (let i = 0; i < numPartidosRonda1; i++) {
      const equipo1 = equiposQueJuegan[i * 2];
      const equipo2 = equiposQueJuegan[i * 2 + 1];

      const [enfResult] = await conn.query(
        'INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero) VALUES (?, ?, ?)',
        [equipo1.id, equipo2.id, numeroPartido]
      );

      await conn.query(
        'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id) VALUES (?, 1, ?, ?)',
        [enfResult.insertId, eventoId, faseInicialId]
      );

      partidosGenerados.push({
        enfrentamiento_id: enfResult.insertId,
        partido_numero: numeroPartido,
        equipo_1: equipo1,
        equipo_2: equipo2,
        es_bye: false,
      });

      numeroPartido++;
    }

    // 6. Generar "enfrentamientos" para equipos con bye
    for (const equipo of equiposConBye) {
      const [enfResult] = await conn.query(
        'INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero) VALUES (?, NULL, ?)',
        [equipo.id, numeroPartido]
      );

      // Los byes avanzan automáticamente: estado 'jugado' y ganador predefinido
      await conn.query(
        'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id, ganador_id) VALUES (?, 2, ?, ?, ?)',
        [enfResult.insertId, eventoId, faseInicialId, equipo.id]
      );

      partidosGenerados.push({
        enfrentamiento_id: enfResult.insertId,
        partido_numero: numeroPartido,
        equipo_1: equipo,
        equipo_2: null,
        es_bye: true,
      });

      numeroPartido++;
    }

    // 7. Obtener todas las fases que se usarán en el torneo
    const [fasesDelTorneo] = await conn.query(
      'SELECT id, nombre, orden FROM fases_evento WHERE evento_id = ? AND orden >= ? ORDER BY orden',
      [eventoId, ordenFaseInicial]
    );

    await conn.commit();

    // Post-procesamiento para Ajedrez: asegurar nombres de jugadores en la respuesta
    if (parseInt(deporteId, 10) === 4) {
      const allPlayerTeamIds = equipos.map(p => p.id);
      if (allPlayerTeamIds.length > 0) {
        const [playerNames] = await conn.query(`
            SELECT e.id AS equipo_id, j.nombre
            FROM equipos e
            JOIN equipo_jugador ej ON e.id = ej.equipo_id
            JOIN jugadores j ON ej.jugador_id = j.id
            WHERE e.id IN (?)
        `, [allPlayerTeamIds]);
        
        const playerNamesMap = new Map(playerNames.map(p => [p.equipo_id, p.nombre]));

        partidosGenerados.forEach(partido => {
            if (partido.equipo_1 && playerNamesMap.has(partido.equipo_1.id)) {
                partido.equipo_1.nombre = playerNamesMap.get(partido.equipo_1.id);
            }
            if (partido.equipo_2 && playerNamesMap.has(partido.equipo_2.id)) {
                partido.equipo_2.nombre = playerNamesMap.get(partido.equipo_2.id);
            }
        });
      }
    }

    // 8. Enviar respuesta
    res.json({
      mensaje: 'Torneo generado exitosamente con estructura dinámica.',
      torneo: {
        deporteId: parseInt(deporteId),
        totalEquipos: numEquipos,
        totalRondas: totalRondas,
        faseInicial: {
          id: faseInicialId,
          nombre: faseInicialNombre,
          orden: ordenFaseInicial,
        },
        estructura: {
          bracket_size: bracketSize,
          equipos_juegan_fase_inicial: equiposQueJuegan.length,
          equipos_con_bye: numByes,
          partidos_fase_inicial: numPartidosRonda1,
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
});

/**
 * POST /api/admin/torneo/avanzar-ronda
 * Avanza automáticamente a la siguiente ronda, manteniendo la lógica del bracket.
 */
torneo.post("/avanzar-ronda", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, faseActualId } = req.body;
    const eventoId = 2;

    if (!deporteId || !faseActualId) {
      return res.status(400).json({
        mensaje: 'Se requiere deporteId y faseActualId'
      });
    }

    await conn.beginTransaction();

    // 1. Validar que todos los partidos de la fase estén finalizados
    const [pendientes] = await conn.query(`
      SELECT COUNT(dp.id) AS total
      FROM detalle_partido dp
      JOIN enfrentamientos enf ON dp.partido_id = enf.id
      JOIN equipos e ON enf.equipo_1_id = e.id
      WHERE dp.fase_id = ?
        AND e.deporte_id = ?
        AND dp.estado_id != 2 -- 2 = 'jugado'
    `, [faseActualId, deporteId]);

    if (pendientes[0].total > 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'Aún hay partidos pendientes en la ronda actual. No se puede avanzar.',
        partidos_pendientes: pendientes[0].total
      });
    }

    // 2. Obtener equipos que avanzan, ORDENADOS por el número de partido de la fase actual
    // Esto es CRÍTICO para mantener la estructura del bracket.
    const [equiposQueAvanzan] = await conn.query(`
      SELECT
          dp.ganador_id AS equipo_id,
          enf.partido_numero
      FROM detalle_partido dp
      JOIN enfrentamientos enf ON dp.partido_id = enf.id
      JOIN equipos e ON dp.ganador_id = e.id
      WHERE dp.fase_id = ?
        AND dp.estado_id = 2 -- Partido jugado (incluye byes)
        AND dp.ganador_id IS NOT NULL
        AND e.deporte_id = ?
      ORDER BY enf.partido_numero ASC
    `, [faseActualId, deporteId]);

    if (equiposQueAvanzan.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay equipos ganadores o con bye en esta fase para avanzar.'
      });
    }

    // 3. Verificar si ya hay un campeón
    if (equiposQueAvanzan.length === 1) {
      const campeonEquipoId = equiposQueAvanzan[0].equipo_id;
      let [campeonInfo] = await conn.query(`
        SELECT e.id, e.nombre, ci.nombre AS ciclo
        FROM equipos e
        INNER JOIN ciclos ci ON e.ciclo_id = ci.id
        WHERE e.id = ?
      `, [campeonEquipoId]);

      let campeon = campeonInfo[0] || null;

      // Para Ajedrez, obtener el nombre del jugador
      if (campeon && parseInt(deporteId, 10) === 4) {
        const [playerInfo] = await conn.query(`
            SELECT j.nombre
            FROM jugadores j
            JOIN equipo_jugador ej ON j.id = ej.jugador_id
            WHERE ej.equipo_id = ?
        `, [campeonEquipoId]);
        
        if (playerInfo.length > 0) {
            campeon.nombre = playerInfo[0].nombre;
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

    // 4. Obtener la siguiente fase
    const [faseActual] = await conn.query('SELECT orden FROM fases_evento WHERE id = ?', [faseActualId]);
    
    const [siguienteFaseArr] = await conn.query(`
      SELECT id, nombre, orden FROM fases_evento
      WHERE evento_id = ? AND orden > ?
      ORDER BY orden ASC
      LIMIT 1
    `, [eventoId, faseActual[0].orden]);

    if (!siguienteFaseArr.length) {
      await conn.rollback();
      // Este caso debería ser manejado por la lógica del campeón, pero como salvaguarda:
      return res.status(400).json({
        mensaje: 'No hay una siguiente fase configurada. El torneo podría haber finalizado.'
      });
    }
    const siguienteFase = siguienteFaseArr[0];

    // 5. Crear los nuevos enfrentamientos para la siguiente ronda
    const partidosNuevos = [];
    let nuevoPartidoNumero = 1;

    for (let i = 0; i < equiposQueAvanzan.length; i += 2) {
      const equipo1 = equiposQueAvanzan[i];
      const equipo2 = equiposQueAvanzan[i + 1] || null; // Puede haber un bye en la siguiente ronda
      const esBye = equipo2 === null;

      const [enfResult] = await conn.query(
        'INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero) VALUES (?, ?, ?)',
        [equipo1.equipo_id, esBye ? null : equipo2.equipo_id, nuevoPartidoNumero]
      );

      const nuevoPartidoId = enfResult.insertId;

      if (esBye) {
        // Si es un bye, el partido se completa automáticamente
        await conn.query(
          'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id, ganador_id) VALUES (?, 2, ?, ?, ?)',
          [nuevoPartidoId, eventoId, siguienteFase.id, equipo1.equipo_id]
        );
      } else {
        // Si es un partido normal, se crea como 'pendiente'
        await conn.query(
          'INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id) VALUES (?, 1, ?, ?)',
          [nuevoPartidoId, eventoId, siguienteFase.id]
        );
      }

      partidosNuevos.push({
        enfrentamiento_id: nuevoPartidoId,
        partido_numero: nuevoPartidoNumero,
        equipo_1_id: equipo1.equipo_id,
        equipo_2_id: esBye ? null : equipo2.equipo_id,
        es_bye: esBye
      });

      nuevoPartidoNumero++;
    }

    await conn.commit();

    res.json({
      mensaje: 'Ronda avanzada exitosamente. Se han creado nuevos enfrentamientos.',
      fase_anterior: {
        id: faseActualId,
        orden: faseActual[0].orden
      },
      siguiente_fase: {
        id: siguienteFase.id,
        nombre: siguienteFase.nombre,
        orden: siguienteFase.orden
      },
      partidos_nuevos: partidosNuevos,
      debug: {
        total_equipos_siguiente_fase: equiposQueAvanzan.length
      }
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
});

/**
 * DELETE /api/admin/torneo/:deporteId
 * Elimina todos los enfrentamientos de un torneo
 */
torneo.delete("/:deporteId", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;
    const eventoId = 2;

    await conn.beginTransaction();

    // Eliminar detalles de partido primero (FK constraint)
    await conn.query(`
      DELETE dp FROM detalle_partido dp
      INNER JOIN enfrentamientos enf ON dp.partido_id = enf.id
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE dp.evento_id = ?
        AND e.deporte_id = ?
    `, [eventoId, deporteId]);

    // Eliminar enfrentamientos
    await conn.query(`
      DELETE enf FROM enfrentamientos enf
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE e.deporte_id = ?
    `, [deporteId]);

    await conn.commit();

    res.json({
      mensaje: 'Torneo reiniciado exitosamente'
    });

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
});

const ESTADOS = {
  EN_PROGRESO: 5,
  FINALIZADO: 2,
};

// Utilidad para obtener fecha formateada
const obtenerFechaActual = () => {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
};

// Función: actualizar a "en_progreso"
async function actualizarEnProgreso(id, fase_id, fecha_inicio) {
  await query(
    `UPDATE detalle_partido SET estado_id = ?, fase_id = ?, fecha_inicio = ? WHERE id = ?`,
    [ESTADOS.EN_PROGRESO, fase_id, fecha_inicio, id]
  );
}

// Función: actualizar a "finalizado"
async function actualizarAFinalizado(id, fase_id, fecha_fin, puntos1, puntos2, ganador_id, perdedor_id) {
  let puntajeGanador = 0;
  let puntajePerdedor = 0;

  // Si estamos en la fase final (fase_id === 4), se asignan más puntos al campeón y subcampeón
  const esFaseFinal = fase_id === 4;

  if (!ganador_id || !perdedor_id) {
    throw new Error("Ganador y perdedor ID son requeridos para registrar el historial del partido");
  }

  if (esFaseFinal) {
    puntajeGanador = 50;
    puntajePerdedor = 30;
  }

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
}


// Función: modificar puntajes sin cambiar estado
async function modificarResultado(id, puntos1, puntos2, ganador_id) {
  await query(
    `UPDATE detalle_partido SET 
      puntos_equipo_1 = ?, 
      puntos_equipo_2 = ?,
      ganador_id = ?
    WHERE id = ?`,
    [puntos1, puntos2, ganador_id, id]
  );
}

/**
 * PATCH /api/admin/torneo/enfrentamientos/:detalle_partido_id/partido
 * Actualiza el estado y resultado de un partido específico.
 */
torneo.patch('/enfrentamientos/:detalle_partido_id/partido', async (req, res) => {
  const { detalle_partido_id } = req.params;
  const {
    estado,
    fase_id,
    puntos_equipo_1,
    puntos_equipo_2,
    ganador_id,
    perdedor_id
  } = req.body;

  // Validar estado
  if (!['en_progreso', 'finalizado', 'modificar'].includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado inválido' });
  }

  const fechaActual = obtenerFechaActual();

  try {
    if (estado === 'en_progreso') {
      if (fase_id === undefined) {
        return res.status(400).json({ mensaje: 'Fase ID requerido para estado en progreso' });
      }

      await actualizarEnProgreso(detalle_partido_id, fase_id, fechaActual);
      return res.status(200).json({ mensaje: 'Detalle partido actualizado a en progreso' });
    }

    if (estado === 'finalizado') {
      if (
        fase_id === undefined ||
        puntos_equipo_1 === undefined ||
        puntos_equipo_2 === undefined ||
        ganador_id === undefined
      ) {
        return res.status(400).json({ mensaje: 'Faltan datos para finalizar el partido' });
      }

      await actualizarAFinalizado(
        detalle_partido_id,
        fase_id,
        fechaActual,
        puntos_equipo_1,
        puntos_equipo_2,
        ganador_id,
        perdedor_id
      );

      return res.status(200).json({ mensaje: 'Detalle partido actualizado a finalizado' });
    }

    if (estado === 'modificar') {
      if (
        puntos_equipo_1 === undefined ||
        puntos_equipo_2 === undefined ||
        ganador_id === undefined
      ) {
        return res.status(400).json({ mensaje: 'Faltan datos para modificar el resultado' });
      }

      await modificarResultado(
        detalle_partido_id,
        puntos_equipo_1,
        puntos_equipo_2,
        ganador_id
      );

      return res.status(200).json({ mensaje: 'Detalle partido modificado correctamente' });
    }

  } catch (e) {
    console.error('❌ Error al actualizar el enfrentamiento:', e.message);
    return res.status(500).json({
      mensaje: 'Error al actualizar el enfrentamiento',
      error: e.message
    });
  }
});

export default torneo;
