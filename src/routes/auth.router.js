// src/routes/auth.router.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { query } from "../config/database.js";
import "dotenv/config";
import { verificarAutenticacion } from "../middleware/auth.middleware.js";

const auth = Router();

// Asume NODE_ENV está definido en tu entorno.
const esProduccion = process.env.NODE_ENV === "production";

auth.post("/login", async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ mensaje: "Faltan credenciales" });
  }

  try {
    const sql = `
    SELECT id, usuario, contrasena 
    FROM usuarios 
    WHERE usuario = ? AND activo = 1 
    LIMIT 1
 `;
    const results = await query(sql, [usuario]);

    if (results.length === 0) {
      console.log("❌ Usuario no encontrado o inactivo");
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    const user = results[0];

    const esValida = await bcrypt.compare(contrasena, user.contrasena);
    if (!esValida) {
      console.log("❌ Contraseña incorrecta");
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    // Generar UUID para la sesión
    const idSesion = uuidv4();
    const ahora = new Date();
    const expiracion = new Date(ahora.getTime() + 60 * 60 * 1000); // 1h

    // Opcional: Actualizar el campo 'ultimo_login' en la tabla 'usuarios'
    await query("UPDATE usuarios SET ultimo_login = ? WHERE id = ?", [
      ahora,
      user.id,
    ]);

    // Guardar la sesión en la DB, inicializando 'ultima_actividad' a la hora actual
    const insertSql = `
      INSERT INTO sesiones (usuario_id, uuid, expira_en, ultima_actividad)
      VALUES (?, ?, ?, ?)
    `;
    await query(insertSql, [user.id, idSesion, expiracion, ahora]);

    // Establecer cookie HttpOnly y segura
    res.cookie("id_sesion", idSesion, {
      httpOnly: true,
      secure: esProduccion, // Solo 'true' si es HTTPS
      sameSite: "Lax",
      expires: expiracion,
      path: "/",
    });

    console.log(`✅ Usuario ${usuario} autenticado - sesión ${idSesion}`);

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      usuario: user.usuario,
    });
  } catch (e) {
    console.error("❌ Error al iniciar sesión:", e.message);
    return res.status(500).json({
      mensaje: "Error interno del servidor",
      error: e.message,
    });
  }
});

auth.post("/logout", async (req, res) => {
  try {
    // Cookie name is consistent: 'id_sesion'
    const idSesion = req.cookies.id_sesion;

    if (!idSesion) {
      return res.status(400).json({ mensaje: "No hay sesión activa" });
    }

    // Eliminar la sesión de la base de datos
    await query("DELETE FROM sesiones WHERE uuid = ?", [idSesion]);

    // Borrar la cookie en el cliente
    res.cookie("id_sesion", "", {
      // Cookie name is consistent: 'id_sesion'
      httpOnly: true,
      secure: esProduccion,
      sameSite: "Lax",
      expires: new Date(0), // fecha pasada para borrar
      path: "/",
    });

    return res.status(200).json({ mensaje: "Sesión cerrada exitosamente" });
  } catch (error) {
    console.error("Error en logout:", error.message);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
});

// Endpoint de verificación de sesión para el frontend
auth.get("/", verificarAutenticacion, (req, res) => {
  // Si pasa el middleware, la sesión es válida. Devolvemos la info del usuario.
  res.status(200).json({
    mensaje: "Sesión activa",
    usuario: req.usuario.usuario,
    rol: req.usuario.rol,
  });
});

export default auth;
