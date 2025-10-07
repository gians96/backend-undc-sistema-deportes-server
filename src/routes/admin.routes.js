// src/routes/admin.routes.js
import { Router } from "express";
import voucher from "./voucher.router.js";
import equipos from "./equipos.router.js";
import torneo from "./torneo.router.js";
import auth from "./auth.router.js";
import { verificarAutenticacion } from "../middleware/auth.middleware.js";

const router = Router();

router.use('/equipos',verificarAutenticacion, equipos)

router.use('/vouchers',verificarAutenticacion, voucher)

router.use('/torneo',verificarAutenticacion, torneo)

router.use('/auth', auth)

export default router;
