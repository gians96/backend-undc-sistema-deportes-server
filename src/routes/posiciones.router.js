import express from "express";
import { query } from "../config/database.js";

const posicion = express.Router();

// Rate Limiter Global: 100 peticiones cada 5 minutos
let contadorPeticiones = 0;
let windowStart = Date.now();
const windowMs = 5 * 60 * 1000;
const maximoPeticiones = 100;

const limitadorPeticiones = (req, res, next) => {
  const ahora = Date.now();
  if (ahora - windowStart > windowMs) {
    windowStart = ahora;
    contadorPeticiones = 1;
    return next();
  }

  contadorPeticiones++;

  // Verificar si se ha excedido el límite
  if (contadorPeticiones > maximoPeticiones) {
    return res.status(429).json({
      mensaje: "Demasiadas peticiones. Inténtalo dentro de 5 minutos.",
    });
  }

  next();
};


posicion.get("/", limitadorPeticiones, async (req, res) => {
  try {
    const deportesMap = {
      1: "futsal",
      2: "basquet",
      3: "voley",
      5: "gincana",
    };

    const queryPosiciones = `CALL obtener_posiciones(?)`;

    const deportesIds = [1, 2, 3];
    // El resultado de un SP con 'mysql2' suele ser un array [rows, fields]
    // por eso mapeamos para quedarnos solo con el primer elemento (rows).
    const promesas = deportesIds.map(deporteId => 
      query(queryPosiciones, [deporteId]).then(results => results[0])
    );

    const resultadosPosicionesGrupales = await Promise.all(promesas);

    const resultadosGrupales = resultadosPosicionesGrupales.reduce((acc, rows, index) => {
      const deporte = deportesMap[deportesIds[index]];
      acc[deporte] = rows;
      return acc;
    }, {});

    res.status(200).json(resultadosGrupales);

  } catch (error) {
    console.error("Error al obtener la tabla de posiciones", error.message);
    res.status(500).json({
      mensaje: "Error al obtener la tabla de posiciones",
      error: error.message,
    });
  }
});

export default posicion;
