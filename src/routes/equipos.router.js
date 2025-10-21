// src/routes/equipos.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const equipos = Router();

equipos.get("/", async (req, res) => {
  try {
    const deportesMap = {
      1: "futsal",
      2: "basquet",
      3: "voley",
      5: "gincana",
    };

    // Consulta unificada para deportes grupales
    const queryGrupales = `
      SELECT
        e.deporte_id,
        e.id AS equipo_id,
        e.nombre AS equipo_nombre,
        ci.nombre AS ciclo,
        e.seccion,
        i.cantidad_participantes AS participantes,
        de.nombre AS deporte,
        v.estado,
        COALESCE(capitan.representante_nombre, 'Sin capitán') AS representante_nombre,
        i.fecha_inscripcion
      FROM equipos e
      INNER JOIN ciclos ci ON e.ciclo_id = ci.id
      INNER JOIN inscripciones i ON e.id = i.equipo_id
      INNER JOIN deportes de ON e.deporte_id = de.id
      INNER JOIN vouchers v ON i.id = v.inscripcion_id
      LEFT JOIN (
        SELECT ej.equipo_id, j.nombre AS representante_nombre
        FROM equipo_jugador ej
        INNER JOIN jugadores j ON ej.jugador_id = j.id
        WHERE j.rol = 'capitan'
      ) capitan ON e.id = capitan.equipo_id
      WHERE e.deporte_id IN (1, 2, 3, 5)
        AND v.estado = 'validado'
    `;

    // Consulta individual para ajedrez
    const queryAjedrez = `
      SELECT
        e.deporte_id,
        j.id AS jugador_id,
        j.nombre AS jugador_nombre,
        ci.nombre AS ciclo,
        e.seccion,
        i.fecha_inscripcion
      FROM jugadores j
      JOIN equipo_jugador ej ON j.id = ej.jugador_id
      JOIN equipos e ON ej.equipo_id = e.id
      JOIN ciclos ci ON e.ciclo_id = ci.id
      JOIN inscripciones i ON e.id = i.equipo_id
      JOIN vouchers v ON i.id = v.inscripcion_id AND v.estado = 'validado'
      WHERE e.deporte_id = 4
    `;

    // Ejecutar ambas consultas en paralelo
    const [resultGrupales, resultAjedrez] = await Promise.all([
      query(queryGrupales),
      query(queryAjedrez),
    ]);

    // Agrupar resultados grupales por deporte usando el mapa
    const resultadosGrupales = resultGrupales.reduce((acc, row) => {
      const deporte = deportesMap[row.deporte_id];
      if (!acc[deporte]) acc[deporte] = [];
      acc[deporte].push(row);
      return acc;
    }, {});

    // Combinar todo
    const response = {
      ...resultadosGrupales,
      ajedrez: resultAjedrez,
    };

    res.status(200).json(response);

  } catch (e) {
    console.error("❌ Error al mostrar los equipos:", e.message);
    res.status(500).json({
      mensaje: "Error al mostrar los equipos",
      error: e.message,
    });
  }
});

equipos.get("/jugadores/:equipo_id", async (req, res) => {
  try {
    const { equipo_id } = req.params;

    // Validación del parámetro
    const idNumero = Number(equipo_id);
    if (!idNumero || isNaN(idNumero) || idNumero <= 0) {
      return res.status(400).json({ mensaje: "El parámetro 'equipo_id' debe ser un número válido mayor que 0." });
    }

    // Consulta para obtener solo nombres de jugadores
    const sql = `
      SELECT j.nombre, j.codigo_estudiante
      FROM equipo_jugador ej
      INNER JOIN jugadores j ON ej.jugador_id = j.id
      WHERE ej.equipo_id = ?;
    `;

    const jugadores = await query(sql, [idNumero]);

    if (jugadores.length === 0) {
      return res.status(404).json({ mensaje: `No se encontraron jugadores para el equipo con ID ${idNumero}.` });
    }

    // Respuesta final
    return res.status(200).json(jugadores);

  } catch (error) {
    console.error("❌ Error al obtener los nombres de los jugadores:", error.message);
    return res.status(500).json({
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});

export default equipos;