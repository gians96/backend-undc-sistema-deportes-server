// src/routes/voucher.router.js
import { Router } from "express";
import { conexion, query } from "../config/database.js";

const voucher = Router();

voucher.get("/", async (req, res) => {
  try {
    const { estado } = req.query;

    let consulta = `
SELECT
    v.id AS id_voucher,
    v.numero_voucher,
    v.banco,
    v.monto,
    v.imagen_url AS nombre_imagen,
    v.titular AS cuenta_titular,
    ci.nombre as ciclo,
    e.nombre AS nombre_equipo,
    i.cantidad_participantes,
    UPPER(dep.nombre)  as deporte,
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

    if (estado) {
      consulta += ' WHERE v.estado = ?'
      params.push(estado)
    }

    consulta += ' ORDER BY v.fecha_subida DESC'

    const vouchers = await query(consulta, params)
    res.json(vouchers)
    
  } catch (e) {
    console.error("Error al mostrar los vouchers");
    console.error("[Error]: ", e.message);
    res.status(500).json({
      mensaje: "Error al mostrar los vouchers",
      error: e.message,
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

    if (!estado || !['validado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado debe ser validado o rechazado' });
    }

    await conn.query(
      'UPDATE vouchers SET estado = ?, fecha_validacion = NOW(), validado_por = ? WHERE id = ?',
      [estado, validado_por, id]
    );

    if (estado === 'validado') {
      await conn.query(
        'UPDATE inscripciones SET pagado = TRUE WHERE id = (SELECT inscripcion_id FROM vouchers WHERE id = ?)',
        [id]
      );
    }

    const [rows] = await conn.query(
      'SELECT * FROM vouchers WHERE id = ?',
      [id]
    );

    await conn.commit();

    res.json({
      mensaje: `Voucher ${estado} exitosamente`,
      voucher: rows[0]
    });

  } catch (error) {
    await conn.rollback();
    console.error("Error en la validación del voucher:", error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

export default voucher;
