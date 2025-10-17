// src/routes/voucher.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const voucher = Router();

voucher.get("/", async (req, res) => {
  try {
    const { estado } = req.query;

    // 1. Validación del parámetro 'estado' (En el Frontend se usan los stores de Pinia)
    const estadosPermitidos = ["pendiente", "validado", "rechazado"];

    if (estado && !estadosPermitidos.includes(estado.toLowerCase())) {
      return res.status(400).json({
        mensaje: `El parámetro 'estado' debe ser uno de: ${estadosPermitidos.join(", ")}`,
      });
    }

    let sql = `
      SELECT
        v.id AS id_voucher,
        e.id AS equipo_id,
        e.seccion,
        v.numero_voucher,
        v.banco,
        v.monto,
        v.imagen_url AS nombre_imagen,
        v.titular AS cuenta_titular,
        ci.nombre AS ciclo,
        e.nombre AS nombre_equipo,
        i.cantidad_participantes,
        UPPER(dep.nombre) AS deporte,
        e.deporte_id,
        v.fecha_subida,
        IFNULL(v.fecha_validacion, 'S/N') AS fecha_validacion,
        IFNULL(v.validado_por, 'No validado') AS validado,
        v.estado
      FROM vouchers v
      INNER JOIN inscripciones i ON v.inscripcion_id = i.id
      INNER JOIN equipos e ON i.equipo_id = e.id
      INNER JOIN ciclos ci ON e.ciclo_id = ci.id
      INNER JOIN deportes dep ON e.deporte_id = dep.id
    `;

    const params = [];

    // 3. Agregar filtro dinámico si se pasó un 'estado'
    if (estado) {
      sql += " WHERE v.estado = ?";
      params.push(estado.toLowerCase());
    }

    sql += " ORDER BY v.fecha_subida DESC";

    const vouchers = await query(sql, params);

    if (vouchers.length === 0) {
      return res.status(404).json({
        mensaje: estado
          ? `No se encontraron vouchers con estado '${estado}'.`
          : "No se encontraron vouchers registrados.",
      });
    }

    return res.status(200).json({
      total: vouchers.length,
      filtros: estado ? { estado } : "sin filtros",
      data: vouchers,
    });

  } catch (error) {
    console.error("❌ Error al mostrar los vouchers:", error.message);
    return res.status(500).json({
      mensaje: "Error interno del servidor al mostrar los vouchers.",
      error: error.message,
    });
  }
});

voucher.get("/:equipo_id", async (req, res) => {
  try {
    const { equipo_id } = req.params;

    // 1️⃣ Validación del parámetro
    if (!equipo_id) {
      return res.status(400).json({ mensaje: "Falta el parámetro 'equipo_id'." });
    }

    const idNumero = Number(equipo_id);
    if (isNaN(idNumero) || idNumero <= 0) {
      return res.status(400).json({ mensaje: "El parámetro 'equipo_id' debe ser un número válido mayor que 0." });
    }

    // 2️⃣ Consultas paralelas
    const sqlJugadores = `
      SELECT j.* 
      FROM equipo_jugador ej
      INNER JOIN equipos e ON ej.equipo_id = e.id
      INNER JOIN jugadores j ON ej.jugador_id = j.id
      WHERE ej.equipo_id = ?;
    `;

    const sqlNombreEquipo = `
      SELECT nombre 
      FROM equipos 
      WHERE id = ?;
    `;

    // 🚀 Ejecutar ambas consultas al mismo tiempo
    const [jugadores, equipoInfo] = await Promise.all([
      query(sqlJugadores, [idNumero]),
      query(sqlNombreEquipo, [idNumero]),
    ]);

    // 3️⃣ Validaciones posteriores
    if (equipoInfo.length === 0) {
      return res.status(404).json({ mensaje: `No se encontró un equipo con ID ${idNumero}.` });
    }

    if (jugadores.length === 0) {
      return res.status(404).json({ mensaje: `No se encontraron jugadores para el equipo con ID ${idNumero}.` });
    }

    const nombreEquipo = equipoInfo[0].nombre;

    // 4️⃣ Respuesta final
    return res.status(200).json({
      equipo_id: idNumero,
      nombre_equipo: nombreEquipo,
      cantidad_jugadores: jugadores.length,
      jugadores,
    });

  } catch (error) {
    console.error("❌ Error al leer los jugadores:", error.message);
    return res.status(500).json({
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  }
});

voucher.patch('/:id/validar', async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { estado } = req.body;
    const validado_por = 1;

    const voucherId = Number(id);
    if (isNaN(voucherId) || voucherId <= 0) {
      return res.status(400).json({ mensaje: "El parámetro 'id' debe ser un número válido mayor que 0." });
    }

    const estadosPermitidos = ["validado", "rechazado"];
    if (!estado || !estadosPermitidos.includes(estado.toLowerCase())) {
      return res.status(400).json({
        mensaje: `El campo 'estado' debe ser uno de: ${estadosPermitidos.join(", ")}.`,
      });
    }

    // Verificar existencia del voucher
    const [voucherExistente] = await conn.query(
      "SELECT id, estado, inscripcion_id FROM vouchers WHERE id = ?",
      [voucherId]
    );

    if (voucherExistente.length === 0) {
      await conn.rollback();
      return res.status(404).json({ mensaje: `No se encontró un voucher con ID ${voucherId}.` });
    }

    const voucherActual = voucherExistente[0];

    // Actualizar estado del voucher
    await conn.query(
      `UPDATE vouchers 
       SET estado = ?, fecha_validacion = NOW(), validado_por = ? 
       WHERE id = ?`,
      [estado.toLowerCase(), validado_por, voucherId]
    );

    if (estado.toLowerCase() === "validado") {
      await conn.query(
        "UPDATE inscripciones SET pagado = TRUE WHERE id = ?",
        [voucherActual.inscripcion_id]
      );
    }

    // 🔹 Obtener voucher actualizado
    const [voucherActualizado] = await conn.query(
      `SELECT v.*, i.pagado 
       FROM vouchers v 
       INNER JOIN inscripciones i ON v.inscripcion_id = i.id
       WHERE v.id = ?`,
      [voucherId]
    );

    await conn.commit();

    return res.status(200).json({
      mensaje: `Voucher ${estado.toLowerCase()} exitosamente.`,
      voucher: voucherActualizado[0],
    });

  } catch (error) {
    await conn.rollback();
    console.error("❌ Error en la validación del voucher:", error);
    return res.status(500).json({
      mensaje: "Error interno del servidor al validar el voucher.",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});

export default voucher;
