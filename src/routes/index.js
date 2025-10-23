// src/routes/index.js
import { Router } from "express";
import inscripciones from './inscripciones.routes.js'
import admin from './admin.routes.js'
import posicion from "./posiciones.router.js";

const router = Router()

router.use('/api/inscripciones', inscripciones)
router.use('/api/admin', admin)
router.use('/api/posiciones', posicion)

export default router