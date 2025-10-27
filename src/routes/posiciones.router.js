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
      4: "ajedrez",
      5: "gincana",
    };

    // Deportes grupales (usan enfrentamientos y detalle_partido)
    const deportesGrupalesIds = [1, 2, 3];
    const queryPosicionesGrupales = `CALL obtener_posiciones(?)`;

    const promesasGrupales = deportesGrupalesIds.map(deporteId =>
      query(queryPosicionesGrupales, [deporteId]).then(results => results[0])
    );

    const resultadosPosicionesGrupales = await Promise.all(promesasGrupales);

    const resultadosGrupales = resultadosPosicionesGrupales.reduce((acc, rows, index) => {
      const deporte = deportesMap[deportesGrupalesIds[index]];
      acc[deporte] = rows;
      return acc;
    }, {});

    // Deportes individuales (usan enfrentamientos_individual y detalle_enfrentamiento)
    const deportesIndividualesIds = [4]; // Ajedrez
    const queryPosicionesIndividuales = `CALL obtener_posiciones_individuales(?)`;

    const promesasIndividuales = deportesIndividualesIds.map(deporteId =>
      query(queryPosicionesIndividuales, [deporteId]).then(results => results[0])
    );

    const resultadosPosicionesIndividuales = await Promise.all(promesasIndividuales);

    const resultadosIndividuales = resultadosPosicionesIndividuales.reduce((acc, rows, index) => {
      const deporte = deportesMap[deportesIndividualesIds[index]];
      acc[deporte] = rows;
      return acc;
    }, {});

    // Combinar resultados grupales e individuales
    const resultadosFinales = {
      ...resultadosGrupales,
      ...resultadosIndividuales
    };

    res.status(200).json(resultadosFinales);

  } catch (error) {
    console.error("Error al obtener la tabla de posiciones", error.message);
    res.status(500).json({
      mensaje: "Error al obtener la tabla de posiciones",
      error: error.message,
    });
  }
});

export default posicion;
