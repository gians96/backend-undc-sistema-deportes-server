// src/routes/index.js
import { Router } from "express";
import inscripciones from './inscripciones.routes.js'
import admin from './admin.routes.js'

const router = Router()

router.use('/api/inscripciones', inscripciones)
router.use('/api/admin', admin)

export default router