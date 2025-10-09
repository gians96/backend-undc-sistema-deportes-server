-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versión del servidor:         8.0.43 - MySQL Community Server - GPL
-- SO del servidor:              Win64
-- HeidiSQL Versión:             12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Volcando estructura de base de datos para ss_sd_vii
CREATE DATABASE IF NOT EXISTS `ss_sd_vii` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `ss_sd_vii`;

-- Volcando estructura para tabla ss_sd_vii.ciclos
CREATE TABLE IF NOT EXISTS `ciclos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.ciclos: ~10 rows (aproximadamente)
INSERT INTO `ciclos` (`id`, `nombre`) VALUES
	(1, 'I'),
	(2, 'II'),
	(3, 'III'),
	(4, 'IV'),
	(5, 'V'),
	(6, 'VI'),
	(7, 'VII'),
	(8, 'VIII'),
	(9, 'IX'),
	(10, 'X');

-- Volcando estructura para tabla ss_sd_vii.deportes
CREATE TABLE IF NOT EXISTS `deportes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `tiempo_promedio_minutos` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.deportes: ~5 rows (aproximadamente)
INSERT INTO `deportes` (`id`, `nombre`, `tiempo_promedio_minutos`) VALUES
	(1, 'futsal', 60),
	(2, 'basquet', NULL),
	(3, 'voley', NULL),
	(4, 'ajedrez', NULL),
	(5, 'gincana', NULL);

-- Volcando estructura para tabla ss_sd_vii.detalle_partido
CREATE TABLE IF NOT EXISTS `detalle_partido` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `partido_id` bigint NOT NULL,
  `estado_id` bigint NOT NULL,
  `evento_id` bigint NOT NULL,
  `programacion_id` bigint DEFAULT NULL,
  `fase_id` bigint DEFAULT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_termino` datetime DEFAULT NULL,
  `lugar` varchar(200) DEFAULT NULL,
  `puntos_equipo_1` int DEFAULT NULL,
  `puntos_equipo_2` int DEFAULT NULL,
  `ganador_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `partido_id` (`partido_id`),
  KEY `fk_dp_fase` (`fase_id`),
  KEY `fk_dp_ganador` (`ganador_id`),
  KEY `idx_dp_evento` (`evento_id`),
  KEY `idx_dp_programacion` (`programacion_id`),
  KEY `idx_dp_partido` (`partido_id`),
  KEY `idx_dp_estado` (`estado_id`),
  KEY `idx_dp_fecha_inicio` (`fecha_inicio`),
  KEY `idx_dp_fecha_termino` (`fecha_termino`),
  CONSTRAINT `fk_dp_estado` FOREIGN KEY (`estado_id`) REFERENCES `estados_partido` (`id`),
  CONSTRAINT `fk_dp_evento` FOREIGN KEY (`evento_id`) REFERENCES `eventos` (`id`),
  CONSTRAINT `fk_dp_fase` FOREIGN KEY (`fase_id`) REFERENCES `fases_evento` (`id`),
  CONSTRAINT `fk_dp_ganador` FOREIGN KEY (`ganador_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_dp_partido` FOREIGN KEY (`partido_id`) REFERENCES `enfrentamientos` (`id`),
  CONSTRAINT `fk_dp_programacion` FOREIGN KEY (`programacion_id`) REFERENCES `programacion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.enfrentamientos
CREATE TABLE IF NOT EXISTS `enfrentamientos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `equipo_1_id` bigint DEFAULT NULL,
  `equipo_2_id` bigint DEFAULT NULL,
  `ganador_id` bigint DEFAULT NULL,
  `partido_numero` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_enf_ganador` (`ganador_id`),
  KEY `idx_enf_equipo1` (`equipo_1_id`),
  KEY `idx_enf_equipo2` (`equipo_2_id`),
  CONSTRAINT `fk_enf_equipo1` FOREIGN KEY (`equipo_1_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_enf_equipo2` FOREIGN KEY (`equipo_2_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_enf_ganador` FOREIGN KEY (`ganador_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `check_equipos_diferentes` CHECK ((`equipo_1_id` <> `equipo_2_id`))
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.equipos
CREATE TABLE IF NOT EXISTS `equipos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `ciclo_id` bigint NOT NULL,
  `deporte_id` bigint NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `celular` varchar(20) DEFAULT NULL,
  `seccion` enum('A','B') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_equipo_nombre` (`nombre`,`ciclo_id`,`deporte_id`),
  KEY `idx_equipos_deporte` (`deporte_id`),
  KEY `idx_equipos_ciclo` (`ciclo_id`),
  CONSTRAINT `fk_equipo_ciclo` FOREIGN KEY (`ciclo_id`) REFERENCES `ciclos` (`id`),
  CONSTRAINT `fk_equipo_deporte` FOREIGN KEY (`deporte_id`) REFERENCES `deportes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.equipo_jugador
CREATE TABLE IF NOT EXISTS `equipo_jugador` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `equipo_id` bigint NOT NULL,
  `jugador_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipo_id` (`equipo_id`,`jugador_id`),
  KEY `fk_eqj_jugador` (`jugador_id`),
  KEY `idx_eqj_equipo` (`equipo_id`),
  CONSTRAINT `fk_eqj_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_eqj_jugador` FOREIGN KEY (`jugador_id`) REFERENCES `jugadores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.estados_partido
CREATE TABLE IF NOT EXISTS `estados_partido` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `estado` enum('pendiente','jugado','cancelado','postergado','en curso') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.estados_partido: ~5 rows (aproximadamente)
INSERT INTO `estados_partido` (`id`, `estado`) VALUES
	(1, 'pendiente'),
	(2, 'jugado'),
	(3, 'cancelado'),
	(4, 'postergado'),
	(5, 'en curso');

-- Volcando estructura para tabla ss_sd_vii.eventos
CREATE TABLE IF NOT EXISTS `eventos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_fin` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.eventos: ~2 rows (aproximadamente)
INSERT INTO `eventos` (`id`, `nombre`, `fecha_inicio`, `fecha_fin`) VALUES
	(1, 'Inscripción de equipos 2025', '2025-10-06 00:00:00', '2025-10-28 00:00:00'),
	(2, 'Semana Sistémica Deportes 2025', '2025-10-20 00:00:00', '2025-10-31 00:00:00');

-- Volcando estructura para tabla ss_sd_vii.fases_evento
CREATE TABLE IF NOT EXISTS `fases_evento` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `evento_id` bigint NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `orden` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `evento_id` (`evento_id`,`orden`),
  KEY `idx_fases_evento_orden` (`evento_id`,`orden`),
  CONSTRAINT `fk_fase_evento` FOREIGN KEY (`evento_id`) REFERENCES `eventos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.fases_evento: ~5 rows (aproximadamente)
INSERT INTO `fases_evento` (`id`, `evento_id`, `nombre`, `orden`) VALUES
	(1, 2, 'Octavos de final', 1),
	(2, 2, 'Cuartos de final', 2),
	(3, 2, 'Semifinal', 3),
	(4, 2, 'Final', 4),
	(5, 2, 'Ronda 1', 0);

-- Volcando estructura para tabla ss_sd_vii.historial_partido_equipo
CREATE TABLE IF NOT EXISTS `historial_partido_equipo` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `equipo_id` bigint NOT NULL,
  `partido_id` bigint NOT NULL,
  `resultado` enum('ganado','perdido','empate') NOT NULL,
  `puntos` int DEFAULT '0',
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipo_id` (`equipo_id`,`partido_id`),
  KEY `idx_hist_equipo` (`equipo_id`),
  KEY `idx_hist_partido` (`partido_id`),
  CONSTRAINT `fk_hist_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_hist_partido` FOREIGN KEY (`partido_id`) REFERENCES `enfrentamientos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.horarios
CREATE TABLE IF NOT EXISTS `horarios` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_horario_valido` CHECK ((`hora_fin` > `hora_inicio`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.horarios: ~0 rows (aproximadamente)
INSERT INTO `horarios` (`id`, `hora_inicio`, `hora_fin`) VALUES
	(1, '10:30:00', '18:30:00');

-- Volcando estructura para tabla ss_sd_vii.inscripciones
CREATE TABLE IF NOT EXISTS `inscripciones` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `equipo_id` bigint NOT NULL,
  `evento_id` bigint NOT NULL,
  `cantidad_participantes` int DEFAULT NULL,
  `pagado` tinyint(1) DEFAULT '0',
  `medio_pago` enum('efectivo','transferencia','tarjeta','otro','Yape') DEFAULT NULL,
  `lugar_pago` varchar(100) DEFAULT NULL,
  `fecha_inscripcion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_pago` enum('regular','adicional') DEFAULT 'regular',
  PRIMARY KEY (`id`),
  UNIQUE KEY `equipo_id` (`equipo_id`,`evento_id`),
  KEY `fk_insc_evento` (`evento_id`),
  CONSTRAINT `fk_insc_equipo` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `fk_insc_evento` FOREIGN KEY (`evento_id`) REFERENCES `eventos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.inscripcion_jugador
CREATE TABLE IF NOT EXISTS `inscripcion_jugador` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inscripcion_id` bigint NOT NULL,
  `jugador_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inscripcion_id` (`inscripcion_id`,`jugador_id`),
  KEY `fk_ij_jugador` (`jugador_id`),
  CONSTRAINT `fk_ij_inscripcion` FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones` (`id`),
  CONSTRAINT `fk_ij_jugador` FOREIGN KEY (`jugador_id`) REFERENCES `jugadores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.jugadores
CREATE TABLE IF NOT EXISTS `jugadores` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) DEFAULT NULL,
  `sexo` enum('M','F','O') DEFAULT 'O',
  `rol` enum('titular','suplente','capitan') DEFAULT 'titular',
  `codigo_estudiante` varchar(12) DEFAULT NULL,
  `dni` varchar(12) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_jugadores_rol` (`rol`),
  KEY `idx_jugadores_sexo` (`sexo`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para procedimiento ss_sd_vii.mostrar_ciclos
DELIMITER //
CREATE PROCEDURE `mostrar_ciclos`()
BEGIN
    SELECT * FROM ciclos;
END//
DELIMITER ;

-- Volcando estructura para procedimiento ss_sd_vii.mostrar_equipos
DELIMITER //
CREATE PROCEDURE `mostrar_equipos`(
	IN `p_evento_id` INT,
	IN `p_deporte_id` INT
)
BEGIN
    SELECT
        e.id AS id_equipo,
        e.nombre AS nombre_equipo,
        d.nombre AS deporte,
        ci.nombre AS ciclo,
        i.cantidad_participantes,
        j.nombre AS representante_nombre,
        e.celular AS representante_telefono,
        v.fecha_validacion AS fecha_inscripcion,
        j.rol AS rol_jugador,
        v.estado AS estado_inscripcion,

        -- Verificar si está asignado con CASE
        CASE
            WHEN enf.enfrentamiento_id IS NOT NULL THEN 'asignado'
            ELSE 'disponible'
        END AS estado_sorteo,

        -- Información del enfrentamiento más reciente
        enf.enfrentamiento_id,
        enf.fase_id,
        enf.fase_nombre,
        enf.fase_orden,
        enf.partido_numero,
        enf.es_bye

    FROM equipos e
    INNER JOIN ciclos ci ON e.ciclo_id = ci.id
    INNER JOIN deportes d ON e.deporte_id = d.id
    INNER JOIN inscripciones i ON i.equipo_id = e.id
    INNER JOIN vouchers v ON v.inscripcion_id = i.id
    INNER JOIN equipo_jugador ej ON e.id = ej.equipo_id
    INNER JOIN jugadores j ON ej.jugador_id = j.id

    -- LEFT JOIN para obtener SOLO el enfrentamiento MÁS RECIENTE de cada equipo
    LEFT JOIN (
        SELECT
            enf2.id AS enfrentamiento_id,
            enf2.partido_numero,
            dp.fase_id,
            f.nombre AS fase_nombre,
            f.orden AS fase_orden,
            CASE WHEN enf2.equipo_2_id IS NULL THEN TRUE ELSE FALSE END AS es_bye,
            -- Usar CASE para identificar qué ID corresponde al equipo
            CASE
                WHEN enf2.equipo_1_id IS NOT NULL THEN enf2.equipo_1_id
                ELSE enf2.equipo_2_id
            END AS equipo_id,
            -- Usar fase_orden para obtener el enfrentamiento más reciente
            ROW_NUMBER() OVER (
                PARTITION BY
                    CASE
                        WHEN enf2.equipo_1_id IS NOT NULL THEN enf2.equipo_1_id
                        ELSE enf2.equipo_2_id
                    END
                ORDER BY f.orden DESC, enf2.id DESC
            ) AS rn
        FROM enfrentamientos enf2
        INNER JOIN detalle_partido dp ON dp.partido_id = enf2.id
        LEFT JOIN fases_evento f ON f.id = dp.fase_id
        WHERE dp.evento_id = p_evento_id
          AND EXISTS (
              SELECT 1 FROM equipos eq
              WHERE eq.id IN (enf2.equipo_1_id, enf2.equipo_2_id)
              AND eq.deporte_id = p_deporte_id
          )
    ) enf ON e.id = enf.equipo_id AND enf.rn = 1

    WHERE
        i.evento_id = p_evento_id
        AND v.estado = 'validado'
        AND e.deporte_id = p_deporte_id
        AND j.rol = 'capitan';
END//
DELIMITER ;

-- Volcando estructura para tabla ss_sd_vii.programacion
CREATE TABLE IF NOT EXISTS `programacion` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `evento_id` bigint NOT NULL,
  `deporte_id` bigint NOT NULL,
  `fecha` date NOT NULL,
  `horario_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `evento_id` (`evento_id`,`deporte_id`,`fecha`,`horario_id`),
  KEY `fk_prog_deporte` (`deporte_id`),
  KEY `fk_prog_horario` (`horario_id`),
  KEY `idx_programacion_fecha` (`fecha`),
  CONSTRAINT `fk_prog_deporte` FOREIGN KEY (`deporte_id`) REFERENCES `deportes` (`id`),
  CONSTRAINT `fk_prog_evento` FOREIGN KEY (`evento_id`) REFERENCES `eventos` (`id`),
  CONSTRAINT `fk_prog_horario` FOREIGN KEY (`horario_id`) REFERENCES `horarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.programacion: ~1 rows (aproximadamente)
INSERT INTO `programacion` (`id`, `evento_id`, `deporte_id`, `fecha`, `horario_id`) VALUES
	(1, 2, 1, '2025-09-20', 1);

-- Volcando estructura para tabla ss_sd_vii.sesiones
CREATE TABLE IF NOT EXISTS `sesiones` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint NOT NULL,
  `uuid` char(36) NOT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expira_en` timestamp NOT NULL,
  `ultima_actividad` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `fk_sesion_usuario` (`usuario_id`),
  CONSTRAINT `fk_sesion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando estructura para tabla ss_sd_vii.usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `rol` enum('admin') DEFAULT 'admin',
  `activo` tinyint(1) DEFAULT '1',
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Volcando datos para la tabla ss_sd_vii.usuarios: ~1 rows (aproximadamente)
INSERT INTO `usuarios` (`id`, `usuario`, `contrasena`, `rol`, `activo`, `ultimo_login`, `creado_en`) VALUES
	(1, 'admin', '$2b$12$4z2k7fDaJK/Z6YBXhw.NSO3UGzLtECS/7T.A3c1AcHOn.56MHD9b2', 'admin', 1, NULL, '2025-09-15 14:20:31');

-- Volcando estructura para procedimiento ss_sd_vii.verificar_codigo_estudiante
DELIMITER //
CREATE PROCEDURE `verificar_codigo_estudiante`(
	IN `p_codigo` VARCHAR(12),
	IN `p_ciclo` INT
)
BEGIN
    SELECT j.id, j.nombre, e.nombre as equipo_nombre 
    FROM jugadores j 
    INNER JOIN equipo_jugador ej ON j.id = ej.jugador_id 
    INNER JOIN equipos e ON ej.equipo_id = e.id 
    WHERE j.codigo_estudiante = p_codigo
	 AND e.ciclo_id = p_ciclo;
END//
DELIMITER ;

-- Volcando estructura para procedimiento ss_sd_vii.verificar_dni
DELIMITER //
CREATE PROCEDURE `verificar_dni`(
	IN `p_dni` VARCHAR(12),
	IN `p_ciclo` INT
)
BEGIN
    SELECT j.id, j.nombre, e.nombre as equipo_nombre 
    FROM jugadores j 
    INNER JOIN equipo_jugador ej ON j.id = ej.jugador_id 
    INNER JOIN equipos e ON ej.equipo_id = e.id 
    WHERE j.dni = p_dni
    AND e.ciclo_id = p_ciclo;
END//
DELIMITER ;

-- Volcando estructura para tabla ss_sd_vii.vouchers
CREATE TABLE IF NOT EXISTS `vouchers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `inscripcion_id` bigint NOT NULL,
  `numero_voucher` varchar(100) NOT NULL,
  `banco` varchar(100) NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `imagen_url` varchar(255) DEFAULT NULL,
  `estado` enum('pendiente','validado','rechazado') DEFAULT 'pendiente',
  `fecha_subida` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_validacion` timestamp NULL DEFAULT NULL,
  `validado_por` bigint DEFAULT NULL,
  `titular` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_voucher` (`numero_voucher`,`banco`),
  KEY `fk_voucher_inscripcion` (`inscripcion_id`),
  CONSTRAINT `fk_voucher_inscripcion` FOREIGN KEY (`inscripcion_id`) REFERENCES `inscripciones` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
