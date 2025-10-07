// src/routes/torneo.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const torneo = Router();

// Tabla de estructura de torneos según partidos.md
const ESTRUCTURA_TORNEO = {
  6: { equiposJuegan: 4, equiposDescansan: 2, totalRondas: 3 },
  7: { equiposJuegan: 6, equiposDescansan: 1, totalRondas: 3 },
  8: { equiposJuegan: 8, equiposDescansan: 0, totalRondas: 3 },
  9: { equiposJuegan: 2, equiposDescansan: 1, totalRondas: 4, nota: 'previa + 6 en R2' },
  10: { equiposJuegan: 4, equiposDescansan: 0, totalRondas: 4, nota: 'previa + 6 en R2' },
  11: { equiposJuegan: 6, equiposDescansan: 5, totalRondas: 4 },
  12: { equiposJuegan: 8, equiposDescansan: 4, totalRondas: 3 },
  13: { equiposJuegan: 10, equiposDescansan: 3, totalRondas: 4 },
  14: { equiposJuegan: 12, equiposDescansan: 2, totalRondas: 4 },
  15: { equiposJuegan: 14, equiposDescansan: 1, totalRondas: 4 },
  16: { equiposJuegan: 16, equiposDescansan: 0, totalRondas: 4 }
};

/**
 * GET /api/admin/torneo/:deporteId
 * Endpoint unificado que devuelve equipos + enfrentamientos + estadísticas
 */
torneo.get("/:deporteId", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId } = req.params;
    const eventoId = 2; // Semana Sistémica Deportes 2025

    // Llamar SP optimizado mostrar_equipos
    const [equiposResult] = await conn.query(
      'CALL mostrar_equipos(?, ?)',
      [eventoId, deporteId]
    );
    const equipos = equiposResult[0] || [];

    // Obtener enfrentamientos existentes con información de fase
    const [enfrentamientos] = await conn.query(`
      SELECT
        enf.id AS enfrentamiento_id,
        dp.id as detalle_partido_id,
        enf.partido_numero,
        f.nombre AS fase_nombre,
        f.orden AS fase_orden,
        e1.id AS equipo_1_id,
        e1.nombre AS equipo_1_nombre,
        c1.nombre AS equipo_1_ciclo,
        e2.id AS equipo_2_id,
        e2.nombre AS equipo_2_nombre,
        c2.nombre AS equipo_2_ciclo,
        CASE WHEN enf.equipo_2_id IS NULL THEN TRUE ELSE FALSE END AS es_bye,
        dp.estado_id,
        dp.puntos_equipo_1,
        dp.puntos_equipo_2,
        dp.ganador_id
      FROM enfrentamientos enf
      INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
      LEFT JOIN fases_evento f ON f.id = dp.fase_id
      LEFT JOIN equipos e1 ON e1.id = enf.equipo_1_id
      LEFT JOIN ciclos c1 ON c1.id = e1.ciclo_id
      LEFT JOIN equipos e2 ON e2.id = enf.equipo_2_id
      LEFT JOIN ciclos c2 ON c2.id = e2.ciclo_id
      WHERE dp.evento_id = ?
        AND (e1.deporte_id = ? OR e2.deporte_id = ?)
      ORDER BY f.orden, enf.partido_numero
    `, [eventoId, deporteId, deporteId]);

    // Calcular estadísticas
    // El SP ahora devuelve solo una fila por equipo (enfrentamiento más reciente)
    const disponibles = equipos.filter(eq => eq.estado_sorteo === 'disponible').length;
    const asignados = equipos.filter(eq => eq.estado_sorteo === 'asignado').length;

    // Obtener información del deporte
    const [deporteInfo] = await conn.query(
      'SELECT id, nombre FROM deportes WHERE id = ?',
      [deporteId]
    );

    res.json({
      deporte: {
        id: parseInt(deporteId),
        nombre: deporteInfo[0]?.nombre || 'N/A'
      },
      equipos: equipos,
      enfrentamientos: enfrentamientos.map(enf => ({
        detalle_partido_id: enf.detalle_partido_id,
        enfrentamiento_id: enf.enfrentamiento_id,
        fase_nombre: enf.fase_nombre,
        fase_orden: enf.fase_orden,
        partido_numero: enf.partido_numero,
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
        estado_id: enf.estado_id,
        resultado: {
          puntos_equipo_1: enf.puntos_equipo_1,
          puntos_equipo_2: enf.puntos_equipo_2
        },
        ganador_id: enf.ganador_id
      })),
      estadisticas: {
        total_equipos: equipos.length,
        equipos_disponibles: disponibles,
        equipos_asignados: asignados,
        total_enfrentamientos: enfrentamientos.length
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
 * Genera todo el torneo en una sola llamada con sorteo aleatorio
 */
torneo.post("/generar", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { deporteId, equipos } = req.body;
    const eventoId = 2;

    // Validar cantidad de equipos
    if (!equipos || equipos.length < 6 || equipos.length > 16) {
      return res.status(400).json({
        mensaje: 'Se requieren entre 6 y 16 equipos para generar un torneo',
        equipos_recibidos: equipos?.length || 0
      });
    }

    await conn.beginTransaction();

    // Calcular estructura del torneo
    const estructura = ESTRUCTURA_TORNEO[equipos.length];
    if (!estructura) {
      throw new Error(`No hay estructura definida para ${equipos.length} equipos`);
    }

    // Determinar fase inicial según total de rondas
    // Fases disponibles: Ronda 1 (0), Octavos (1), Cuartos (2), Semifinal (3), Final (4)
    // - 3 rondas (6-8, 12 equipos): Cuartos (2) → Semifinal (3) → Final (4)
    // - 4 rondas (9-16 equipos): Ronda 1/Octavos → Cuartos → Semifinal → Final
    const ordenFaseInicial = 5 - estructura.totalRondas; // 3 rondas → 2 (Cuartos), 4 rondas → 1 (Octavos)

    // Para equipos que requieren ronda previa (9-10), usar Ronda 1 (orden = 0)
    const usarRondaPrevia = equipos.length >= 9 && equipos.length <= 10;
    const ordenInicial = usarRondaPrevia ? 0 : ordenFaseInicial;

    // Obtener fase inicial
    let [fases] = await conn.query(`
      SELECT id, nombre, orden FROM fases_evento
      WHERE evento_id = ? AND orden = ?
      LIMIT 1
    `, [eventoId, ordenInicial]);

    let faseInicialId = fases[0]?.id;
    let faseInicialNombre = fases[0]?.nombre;

    if (!faseInicialId) {
      throw new Error(`No existe la fase con orden ${ordenInicial} para el evento ${eventoId}`);
    }

    // Sorteo aleatorio de equipos
    const equiposAleatorios = [...equipos].sort(() => Math.random() - 0.5);

    // Dividir equipos según la estructura
    const equiposQueJuegan = equiposAleatorios.slice(0, estructura.equiposJuegan);
    const equiposQueDescansan = equiposAleatorios.slice(estructura.equiposJuegan);

    const ronda1 = [];
    const partidosRonda1 = Math.floor(estructura.equiposJuegan / 2);
    let numeroPartido = 1;

    // Generar enfrentamientos de Ronda 1 (equipos que juegan)
    for (let i = 0; i < partidosRonda1; i++) {
      const equipo1 = equiposQueJuegan[i * 2];
      const equipo2 = equiposQueJuegan[i * 2 + 1];

      // Insertar enfrentamiento
      const [enfResult] = await conn.query(`
        INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero)
        VALUES (?, ?, ?)
      `, [equipo1.id, equipo2.id, numeroPartido]);

      // Insertar detalle_partido
      await conn.query(`
        INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id)
        VALUES (?, 1, ?, ?)
      `, [enfResult.insertId, eventoId, faseInicialId]);

      ronda1.push({
        enfrentamiento_id: enfResult.insertId,
        partido_numero: numeroPartido,
        equipo_1: equipo1,
        equipo_2: equipo2,
        es_bye: false
      });

      numeroPartido++;
    }

    // ✅ NUEVO: Generar byes para equipos que descansan
    for (const equipo of equiposQueDescansan) {
      // Insertar enfrentamiento con equipo_2_id = null (bye)
      const [enfResult] = await conn.query(`
        INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero)
        VALUES (?, NULL, ?)
      `, [equipo.id, numeroPartido]);

      // Insertar detalle_partido con estado "jugado" (pasa automáticamente)
      await conn.query(`
        INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id, ganador_id)
        VALUES (?, 2, ?, ?, ?)
      `, [enfResult.insertId, eventoId, faseInicialId, equipo.id]);

      ronda1.push({
        enfrentamiento_id: enfResult.insertId,
        partido_numero: numeroPartido,
        equipo_1: equipo,
        equipo_2: null,
        es_bye: true
      });

      numeroPartido++;
    }

    // Obtener fases existentes para el torneo (desde la fase inicial hacia adelante)
    const [fasesExistentes] = await conn.query(`
      SELECT id, nombre, orden
      FROM fases_evento
      WHERE evento_id = ? AND orden >= ?
      ORDER BY orden
    `, [eventoId, ordenInicial]);

    await conn.commit();

    res.json({
      mensaje: 'Torneo generado exitosamente',
      torneo: {
        deporteId: parseInt(deporteId),
        totalEquipos: equipos.length,
        totalRondas: estructura.totalRondas,
        faseInicial: {
          id: faseInicialId,
          nombre: faseInicialNombre,
          orden: ordenInicial
        },
        estructura: {
          equipos_juegan_fase_inicial: estructura.equiposJuegan,
          equipos_descansan: estructura.equiposDescansan,
          partidos_fase_inicial: partidosRonda1,
          byes_fase_inicial: equiposQueDescansan.length
        },
        rondas: fasesExistentes.map((f, index) => ({
          fase_id: f.id,
          nombre: f.nombre,
          orden: f.orden,
          partidos: index === 0 ? ronda1 : [] // Solo la primera fase tiene partidos generados
        }))
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error al generar torneo:', error.message);
    res.status(500).json({
      mensaje: 'Error al generar torneo',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/admin/torneo/avanzar-ronda
 * Avanza automáticamente a la siguiente ronda con validaciones
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

    // Validar que todos los partidos estén finalizados
    const [pendientes] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM enfrentamientos enf
      INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE e.deporte_id = ?
        AND dp.fase_id = ?
        AND dp.estado_id != 2
    `, [deporteId, faseActualId]);

    if (pendientes[0].total > 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'Aún hay partidos pendientes en la ronda actual',
        partidos_pendientes: pendientes[0].total
      });
    }

    // 1. Obtener ganadores de partidos REALES (no BYEs)
    // Excluir enfrentamientos donde equipo_2_id es NULL (BYEs)
    const [ganadores] = await conn.query(`
      SELECT DISTINCT dp.ganador_id AS equipo_id
      FROM enfrentamientos enf
      INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
      INNER JOIN equipos e ON e.id IN (enf.equipo_1_id, enf.equipo_2_id)
      WHERE e.deporte_id = ?
        AND dp.fase_id = ?
        AND dp.estado_id = 2
        AND dp.ganador_id IS NOT NULL
        AND enf.equipo_2_id IS NOT NULL
    `, [deporteId, faseActualId]);

    // 2. Obtener equipos con BYE en la fase actual
    // Los BYEs son equipos que avanzaron automáticamente (equipo_2_id = NULL)
    const [equiposConBye] = await conn.query(`
      SELECT DISTINCT enf.equipo_1_id AS equipo_id
      FROM enfrentamientos enf
      INNER JOIN detalle_partido dp ON dp.partido_id = enf.id
      WHERE dp.fase_id = ?
        AND enf.equipo_2_id IS NULL
        AND dp.estado_id = 2
        AND dp.ganador_id IS NOT NULL
    `, [faseActualId]);

    let equiposQueDescansaron = equiposConBye;

    // 3. Combinar ganadores + equipos que descansaron (BYEs)
    const equiposParaSiguienteFase = [
      ...ganadores.map(g => ({ equipo_id: g.equipo_id })),
      ...equiposQueDescansaron.map(e => ({ equipo_id: e.equipo_id }))
    ];

    if (equiposParaSiguienteFase.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay equipos para avanzar a la siguiente fase'
      });
    }

    // ✅ NUEVO: Si solo queda 1 equipo, ese equipo es el campeón
    if (equiposParaSiguienteFase.length === 1) {
      const [equipoCampeon] = await conn.query(`
        SELECT e.id, e.nombre, ci.nombre AS ciclo
        FROM equipos e
        INNER JOIN ciclos ci ON e.ciclo_id = ci.id
        WHERE e.id = ?
      `, [equiposParaSiguienteFase[0].equipo_id]);

      await conn.commit();

      return res.json({
        mensaje: '¡Torneo finalizado! Campeón definido.',
        torneo_finalizado: true,
        campeon: {
          id: equipoCampeon[0].id,
          nombre: equipoCampeon[0].nombre,
          ciclo: equipoCampeon[0].ciclo
        },
        fase_actual: {
          id: faseActualId
        }
      });
    }

    // Obtener siguiente fase
    const [faseActual] = await conn.query(`
      SELECT orden FROM fases_evento WHERE id = ?
    `, [faseActualId]);

    const [siguienteFase] = await conn.query(`
      SELECT id, nombre, orden FROM fases_evento
      WHERE evento_id = ? AND orden > ?
      ORDER BY orden ASC
      LIMIT 1
    `, [eventoId, faseActual[0].orden]);

    if (!siguienteFase.length) {
      await conn.rollback();
      return res.status(400).json({
        mensaje: 'No hay siguiente fase configurada. El torneo ha finalizado.'
      });
    }

    const siguienteFaseId = siguienteFase[0].id;
    const partidosNuevos = [];

    // Crear enfrentamientos de siguiente ronda usando equipos clasificados (ganadores + equipos que descansaron)
    for (let i = 0; i < equiposParaSiguienteFase.length; i += 2) {
      const equipo1 = equiposParaSiguienteFase[i];
      const equipo2 = equiposParaSiguienteFase[i + 1] || null;
      const esBye = equipo2 === null;

      const [enfResult] = await conn.query(`
        INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, partido_numero)
        VALUES (?, ?, ?)
      `, [equipo1.equipo_id, equipo2?.equipo_id || null, Math.floor(i / 2) + 1]);

      // ✅ Si es BYE, marcar como finalizado automáticamente con ganador
      if (esBye) {
        await conn.query(`
          INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id, ganador_id)
          VALUES (?, 2, ?, ?, ?)
        `, [enfResult.insertId, eventoId, siguienteFaseId, equipo1.equipo_id]);
      } else {
        await conn.query(`
          INSERT INTO detalle_partido (partido_id, estado_id, evento_id, fase_id)
          VALUES (?, 1, ?, ?)
        `, [enfResult.insertId, eventoId, siguienteFaseId]);
      }

      partidosNuevos.push({
        enfrentamiento_id: enfResult.insertId,
        partido_numero: Math.floor(i / 2) + 1,
        equipo_1_id: equipo1.equipo_id,
        equipo_2_id: equipo2?.equipo_id || null,
        es_bye: esBye
      });
    }

    await conn.commit();

    res.json({
      mensaje: 'Ronda avanzada exitosamente',
      fase_anterior: {
        id: faseActualId,
        orden: faseActual[0].orden
      },
      siguiente_fase: {
        id: siguienteFaseId,
        nombre: siguienteFase[0].nombre,
        orden: siguienteFase[0].orden
      },
      partidos_nuevos: partidosNuevos,
      debug: {
        ganadores_partidos: ganadores.length,
        equipos_con_bye: equiposQueDescansaron.length,
        total_equipos_siguiente_fase: equiposParaSiguienteFase.length
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

export default torneo;
