// src/middleware/auth.middleware.js
import { query } from "../config/database.js";

export const verificarAutenticacion = async (req, res, next) => {
  try {
    const idSesion = req.cookies.id_sesion;

    if (!idSesion) {
      return res
        .status(401)
        .json({ mensaje: "No autenticado - no hay cookie" });
    }

    const ahora = new Date(); // esta hora está adelantado por zona UTC :v se le va restar -5 horas manualmente pipipi nomas
    const horaCerruana = new Date(ahora);
    horaCerruana.setHours(horaCerruana.getHours() - 5);

    const sql = `
      SELECT u.id, u.usuario, u.rol, s.ultima_actividad
      FROM sesiones s
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.uuid = ?
        AND s.expira_en > ?
        AND s.ultima_actividad > DATE_SUB(?, INTERVAL 15 MINUTE)
      LIMIT 1
    `;

    const resultados = await query(sql, [idSesion, horaCerruana, horaCerruana]);

    if (resultados.length === 0) {
      return res.status(401).json({ mensaje: "Sesión inválida o expirada" });
    } // 2. Adjuntar la info del usuario autenticado

    req.usuario = {
      id: resultados[0].id,
      usuario: resultados[0].usuario,
      rol: resultados[0].rol,
    }; // 3. Actualizar la última actividad (de forma asíncrona, sin bloquear)

    query("UPDATE sesiones SET ultima_actividad = ? WHERE uuid = ?", [
      ahora,
      idSesion,
    ]).catch((err) =>
      console.error("⚠️ No se pudo actualizar ultima_actividad:", err.message)
    );

    next();
  } catch (error) {
    console.error("❌ Error en authMiddleware:", error.message);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};
