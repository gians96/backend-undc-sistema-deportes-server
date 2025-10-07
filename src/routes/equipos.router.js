// src/routes/equipos.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const equipos = Router();

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

equipos.get("/:id_deporte", async (req, res) => {
  try {
    const { id_deporte } = req.params;
    let consulta = "CALL mostrar_equipos(?, ?);";
    const evento_id = 2;
    const [respuesta] = await query(consulta, [evento_id, id_deporte]);

    res.status(200).json(respuesta);
  } catch (e) {
    console.error("Error al mostrar los equipos");
    console.error("[Error]: ", e.message);
    res.status(500).json({
      mensaje: "Error al mostrar los equipos",
      error: e.message,
    });
  }
});

equipos.post("/enfrentamiento", async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const { primerId, segundoId, fase_id = null } = req.body;

    // 1. Validación básica
    if (!primerId) {
      console.error('Debe ingresar el valor para el Equipo 1');
      return res.status(400).json({
        mensaje: "Falta el campo equipo 1",
        requiere: ["equipo 1"]
      });
    }

    if (primerId === segundoId) {
      console.error('[Error] No se pueden enfrentar los mismos equipos');
      return res.status(400).json({
        mensaje: "No se pueden enfrentar los mismos equipos",
        error: "Los IDs de equipo 1 y equipo 2 son iguales"
      });
    }

    // 2. Valores predeterminados
    const evento_id = 2;        // deporte
    const estado_id = 1;        // pendiente
    const programacion_id = 1;  // valor fijo
    const segundoEquipo = segundoId ?? null;

    await conn.beginTransaction();
    console.log('[enfrentamiento]: Transacción iniciada');

    try {
      // 3. Insertar enfrentamiento
      const [enfrentamiento] = await conn.execute(
        "INSERT INTO enfrentamientos (equipo_1_id, equipo_2_id, ganador_id) VALUES (?, ?, ?)",
        [primerId, segundoEquipo, null]
      );
      const partido_id = enfrentamiento.insertId;
      console.log('[enfrentamiento] Enfrentamiento registrado ID', partido_id);

      // 4. Insertar detalle_partido (fase_id puede ser null)
      await conn.execute(
        `INSERT INTO detalle_partido (partido_id, estado_id, evento_id, programacion_id, fase_id) VALUES (?, ?, ?, ?, ?)`,
        [partido_id, estado_id, evento_id, programacion_id, fase_id]
      );
      console.log('[enfrentamiento] Detalle partido registrado');

      await conn.commit();
      console.log('[enfrentamiento] Transacción confirmada');

      res.status(201).json({
        mensaje: "Enfrentamiento registrado correctamente",
        id: partido_id
      });

    } catch (transaccion) {
      await conn.rollback();
      console.error('Error en la transacción: ROLLBACK ejecutado');
      console.error('[Error]', transaccion.message);
      return res.status(500).json({
        mensaje: "Error al registrar los enfrentamientos",
        error: transaccion.message
      });
    }

  } catch (e) {
    console.error("Error al registrar los equipos");
    console.error("[Error]", e.message);
    res.status(500).json({
      mensaje: "Error al registrar los equipos",
      error: e.message,
    });
  } finally {
    conn.release();
  }
});

equipos.get('/enfrentamientos/:id_deporte', async (req, res) => {
  try {
    const { id_deporte } = req.params
    let consulta = `
      SELECT 
        dp.id AS detalle_partido_id,
        e.id AS enfrentamiento_id,
        e.equipo_1_id,
        eq.nombre AS equipo_1_nombre,
        ci.nombre AS equipo_1_ciclo,
        dp.puntos_equipo_1,
        e.equipo_2_id, 
        eq2.nombre AS equipo_2_nombre,
        ci2.nombre AS equipo_2_ciclo,
        dp.puntos_equipo_2,
        dp.estado_id,
        dp.fase_id
      FROM detalle_partido dp
      INNER JOIN enfrentamientos e ON dp.partido_id = e.id
      INNER JOIN equipos eq ON e.equipo_1_id = eq.id
      INNER JOIN ciclos ci ON eq.ciclo_id = ci.id
      LEFT JOIN equipos eq2 ON e.equipo_2_id = eq2.id
      LEFT JOIN ciclos ci2 ON eq2.ciclo_id = ci2.id
      WHERE dp.evento_id = ?
      AND eq.deporte_id = ?
    `;
    const evento_id = 2;
    const resultado = await query(consulta, [
      evento_id, id_deporte
    ])
    res.status(200).json(resultado)

  } catch (e) {
    console.error('Error al mostrar los enfrentamientos');
    console.error("[Error]: ", e.message);
    res.status(500).json({
      mensaje: "Error al mostrar los enfrentamientos",
      error: e.message,
    });
  }
})

equipos.patch('/enfrentamientos/:detalle_partido_id/partido', async (req, res) => {
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

export default equipos;
