// src/routes/inscripciones.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { conexion } from "../config/database.js";

const __archivo = fileURLToPath(import.meta.url);
const __directorio = path.dirname(__archivo);

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__directorio, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const sufijo = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "voucher-" + sufijo + path.extname(file.originalname));
  },
});

const filtroArchivos = (req, archivo, cb) => {
  // Aceptar solo imágenes
  if (archivo.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen"), false);
  }
};

const subir = multer({
  storage: almacenamiento,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB por defecto
  },
  fileFilter: filtroArchivos,
});

const ruta = express.Router();

// Función auxiliar para limpiar archivos en caso de error
const limpiarArchivo = async (filename) => {
  if (filename) {
    try {
      const fs = await import("fs");
      const filePath = path.join(__directorio, "../../uploads", filename);
      fs.unlinkSync(filePath);
      console.log("🗑️ Archivo voucher eliminado:", filename);
    } catch (fileError) {
      console.error("⚠️ No se pudo eliminar el archivo:", fileError.message);
    }
  }
};

ruta.post("/", subir.single("comprobante"), async (req, res) => {
  const pool = await conexion();
  const conn = await pool.getConnection();

  try {
    const {
      cicloId,
      email,
      celular,
      equipoNombre,
      deporteId,
      jugadores,
      cantidadParticipantes,
      numeroOperacion,
      tipoPago,
      titularCuenta,
    } = req.body;

    let { seccion } = req.body;

    // 1. Validar campos obligatorios
    if (!deporteId || !cicloId || !equipoNombre || !numeroOperacion) {
      return res.status(400).json({
        mensaje: "Faltan campos requeridos",
        requiere: [
          "deporte",
          "ciclo",
          "nombre del equipo",
          "numero de operación",
        ],
      });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ mensaje: "Se requiere el archivo voucher" });
    }

    // Corrige el valor si viene como string 'null' o no está presente
    if (seccion === "null" || seccion === undefined || seccion === "") {
      seccion = null;
    }

    // 2. Validar que la fecha de inscripción esté dentro del rango
    const [validarInscripcion] = await conn.execute(
      "SELECT * FROM eventos WHERE id = 1"
    );

    if (!validarInscripcion.length) {
      await limpiarArchivo(req.file.filename);
      return res
        .status(400)
        .json({ mensaje: "Evento de inscripción no encontrado" });
    }

    const fechaFin = new Date(validarInscripcion[0].fecha_fin);
    const presente = new Date();

    if (fechaFin < presente) {
      await limpiarArchivo(req.file.filename);
      return res
        .status(400)
        .json({ mensaje: "La fecha límite de inscripción ha pasado" });
    }

    // 3. Parsear jugadores
    let dataJugadores = [];
    try {
      dataJugadores = JSON.parse(jugadores || "[]");
      if (!Array.isArray(dataJugadores)) throw new Error();
    } catch (error) {
      await limpiarArchivo(req.file.filename);
      return res.status(400).json({ mensaje: "Formato de jugadores inválido" });
    }

    if (dataJugadores.length === 0) {
      await limpiarArchivo(req.file.filename);
      return res
        .status(400)
        .json({ mensaje: "Debe incluir al menos un jugador" });
    }

    // 3.1 Validar cantidad de jugadores y género según el deporte
    const totalJugadores = dataJugadores.length;
    const mujeres = dataJugadores.filter((j) => j.sexo === "F").length;
    const varones = dataJugadores.filter((j) => j.sexo === "M").length;

    switch (parseInt(deporteId)) {
      case 1: // Fútsal
        if (totalJugadores < 5 || totalJugadores > 10) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Fútsal requiere entre 5 y 10 jugadores",
          });
        }
        break;
      
      case 2:
        if (totalJugadores < 4 || totalJugadores > 10) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Básquet requiere entre 4 a 10 jugadores"
          })
        }
        break;

      case 3: // Vóley
        if (totalJugadores < 5 || totalJugadores > 10) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Vóley requiere entre 5 y 10 jugadores",
          });
        }
        if (mujeres < 2) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Vóley requiere al menos 2 mujeres en el equipo",
          });
        }
        break;

      case 5: // Gincana
        if (totalJugadores < 3 || totalJugadores > 33) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Gincana requiere entre 3 y 16 jugadores",
          });
        }
        if (mujeres < 1) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Gincana requiere al menos 1 mujer en el equipo",
          });
        }
        break;

      case 4: // Ajedrez
        if (totalJugadores < 1 || totalJugadores > 4) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Ajedrez requiere entre 1 y 4 jugadores",
          });
        }
        if (varones > 2 || mujeres > 2) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "Ajedrez permite máximo 2 varones y 2 mujeres",
          });
        }
        break;

      default:
        // Otros deportes: permitir entre 1 y 20 jugadores sin restricciones
        if (totalJugadores < 1 || totalJugadores > 20) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: "El número de jugadores debe estar entre 1 y 20",
          });
        }
    }

    // 4. Validar que no exista un equipo con el mismo nombre en el mismo ciclo
    const [equipoExistente] = await conn.execute(
      "SELECT id FROM equipos WHERE nombre = ? AND ciclo_id = ?",
      [equipoNombre, cicloId]
    );

    if (equipoExistente.length > 0) {
      await limpiarArchivo(req.file.filename);
      return res.status(400).json({
        mensaje: "Ya existe un equipo con este nombre en el ciclo seleccionado",
      });
    }

    // 5. VALIDAR TODOS LOS JUGADORES ANTES DE LA TRANSACCIÓN
    console.log("🔍 Validando jugadores antes de la transacción...");

    for (let i = 0; i < dataJugadores.length; i++) {
      const player = dataJugadores[i];
      try {
        if (!player.nombre || !player.dni) {
          await limpiarArchivo(req.file.filename);
          return res.status(400).json({
            mensaje: `Jugador ${i + 1}: faltan nombre o DNI`,
          });
        }

        const [dniResult] = await conn.execute(`CALL verificar_dni(?, ?)`, [
          player.dni,
          cicloId,
        ]);

        if (dniResult.length > 0) {
          const dniInfo = dniResult[0];
          if (dniInfo && dniInfo.equipo_nombre) {
            console.warn(
              `El DNI ${player.dni} ya está registrado en este ciclo en el equipo: ${dniInfo.equipo_nombre}`
            );
            await limpiarArchivo(req.file.filename);
            return res.status(400).json({
              mensaje: `El DNI ${player.dni} ya está registrado en este ciclo en el equipo: ${dniInfo.equipo_nombre}`,
            });
          }
        }

        if (player.codigo) {
          const [codigoResult] = await conn.execute(
            `CALL verificar_codigo_estudiante(?, ?)`,
            [player.codigo, cicloId]
          );

          if (codigoResult.length > 0) {
            const codigoInfo = codigoResult[0];
            if (codigoInfo && codigoInfo.equipo_nombre) {
              console.warn(
                `El código de estudiante ${player.codigo} ya está registrado en este ciclo en el equipo: ${codigoInfo.equipo_nombre}`
              );
              await limpiarArchivo(req.file.filename);
              return res.status(400).json({
                mensaje: `El código de estudiante ${player.codigo} ya está registrado en este ciclo en el equipo: ${codigoInfo.equipo_nombre}`,
              });
            }
          }
        }
      } catch (validationError) {
        console.error(
          `Error validando jugador ${player.nombre} - ${validationError.message}`
        );
        await limpiarArchivo(req.file.filename);
        return res.status(500).json({
          mensaje: `Error validando jugador ${player.nombre}`,
          error: validationError.message,
        });
      }
    }

    console.log("✅ Todas las validaciones pasaron, iniciando transacción...");

    // 6. INICIAR TRANSACCIÓN MANUAL (solo después de validar todo)
    await conn.beginTransaction();
    console.log("🔄 Transacción iniciada");

    let equipoId, inscripcionId;
    const jugadoresIds = [];

    try {
      // 6.1. Registrar equipo
      const [equipoResult] = await conn.execute(
        "INSERT INTO equipos (nombre, ciclo_id, deporte_id, email, celular, seccion) VALUES (?, ?, ?, ?, ?, ?)",
        [equipoNombre, cicloId, deporteId, email, celular, seccion]
      );

      equipoId = equipoResult.insertId;
      console.log(`✅ Equipo registrado con ID: ${equipoId}`);

      // 6.2. Registrar jugadores (ya validados previamente)
      for (let i = 0; i < dataJugadores.length; i++) {
        const player = dataJugadores[i];

        // Insertar jugador
        const [jugadorResult] = await conn.execute(
          "INSERT INTO jugadores (nombre, sexo, rol, codigo_estudiante, dni) VALUES (?, ?, ?, ?, ?)",
          [
            player.nombre,
            player.sexo || "O",
            player.rol || "suplente",
            player.codigo || null,
            player.dni,
          ]
        );

        const jugadorId = jugadorResult.insertId;
        jugadoresIds.push(jugadorId);

        // Relacionar jugador con equipo
        await conn.execute(
          "INSERT INTO equipo_jugador (equipo_id, jugador_id) VALUES (?, ?)",
          [equipoId, jugadorId]
        );

        console.log(
          `✅ Jugador ${player.nombre} registrado con ID: ${jugadorId}`
        );
      }

      // 6.3. Registrar inscripción
      const mapaMonto = {
        regular: 80,
        adicional: 15,
        basket: 10,
      };

      const banco = "Yape";
      const monto =
        tipoPago === "regular" || tipoPago === "adicional" || tipoPago === 'basket'
          ? mapaMonto[tipoPago]
          : null;
      const eventoId = 2; // ID del evento de inscripción

      const [inscripcionResult] = await conn.execute(
        "INSERT INTO inscripciones (equipo_id, evento_id, cantidad_participantes, pagado, medio_pago, lugar_pago, tipo_pago) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          equipoId,
          eventoId,
          cantidadParticipantes || dataJugadores.length,
          false,
          banco,
          "Sistema",
          tipoPago,
        ]
      );

      inscripcionId = inscripcionResult.insertId;
      console.log(`✅ Inscripción registrada con ID: ${inscripcionId}`);

      // 6.4. Registrar voucher de pago
      if (req.file && banco && numeroOperacion && monto) {
        await conn.execute(
          "INSERT INTO vouchers (inscripcion_id, numero_voucher, banco, monto, imagen_url, estado, titular) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            inscripcionId,
            numeroOperacion,
            banco,
            parseFloat(monto),
            req.file.filename,
            "pendiente",
            titularCuenta || "Sin especificar",
          ]
        );
        console.log(`✅ Voucher registrado para inscripción ${inscripcionId}`);
      }

      // 6.5. Registrar relaciones inscripción-jugador
      for (const jugadorId of jugadoresIds) {
        await conn.execute(
          "INSERT INTO inscripcion_jugador (inscripcion_id, jugador_id) VALUES (?, ?)",
          [inscripcionId, jugadorId]
        );
      }
      console.log(`✅ Relaciones inscripción-jugador registradas`);

      // 7. CONFIRMAR TRANSACCIÓN
      await conn.commit();
      console.log("✅ Transacción confirmada exitosamente");

      // 8. Preparar respuesta
      const mapaDeportes = {
        1: "Fútsal",
        2: "Básquet",
        3: "Vóley",
        4: "Ajedrez",
        5: "Gincana",
      };

      const nombreDeporte = mapaDeportes[deporteId] || "Otro";

      res.status(201).json({
        mensaje: "Inscripción realizada exitosamente",
        data: {
          equipoId,
          equipoNombre,
          nombreDeporte,
          inscripcionId,
          voucherSubido: !!req.file,
          cantidadJugadores: dataJugadores.length,
          jugadores: dataJugadores.map((jugador, index) => ({
            nombre: jugador.nombre,
            dni: jugador.dni,
            codigo: jugador.codigo,
            id: jugadoresIds[index],
          })),
        },
      });
    } catch (transactionError) {
      // ROLLBACK AUTOMÁTICO en caso de error dentro de la transacción
      await conn.rollback();
      console.error(
        "❌ Error en transacción, rollback ejecutado:",
        transactionError.message
      );

      // Limpiar archivo
      await limpiarArchivo(req.file?.filename);

      res.status(500).json({
        mensaje: "Error al procesar la inscripción",
        error: transactionError.message,
        detalles: "La transacción ha sido revertida",
      });
    }
  } catch (error) {
    console.error("❌ Error general en inscripción:", error.message);

    // Limpiar archivo en caso de error
    await limpiarArchivo(req.file?.filename);

    res.status(500).json({
      mensaje: "Error interno del servidor",
      error: error.message,
    });
  } finally {
    // SIEMPRE liberar la conexión
    if (conn) {
      conn.release();
      console.log("🔌 Conexión liberada");
    }
  }
});

export default ruta;
