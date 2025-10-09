# Sistema de Deportes UNDC - Backend

## 📋 Descripción

Backend del sistema de gestión deportiva de la Universidad Nacional Daniel Carrión (UNDC). Esta API REST maneja inscripciones de equipos, torneos, validación de vouchers y administración general del sistema deportivo universitario.

## 🚀 Tecnologías Utilizadas

- **Node.js** v22.13.1+
- **Express.js** 5.1.0 - Framework web
- **MySQL** 8.0.43 - Base de datos
- **MySQL2** 3.14.5 - Driver de base de datos con soporte para promesas
- **Socket.io** 4.8.1 - Comunicación en tiempo real
- **JWT** - Autenticación y autorización
- **bcrypt** - Encriptación de contraseñas
- **Multer** - Manejo de archivos (vouchers)
- **CORS** - Configuración de dominios permitidos
- **Helmet** - Middleware de seguridad
- **Morgan** - Logger de peticiones HTTP

## 📊 Base de Datos

### Estructura Principal

El sistema cuenta con las siguientes entidades principales:

#### **Tabla: `ciclos`**
Gestiona los ciclos académicos (I al X).
- `id` - Identificador único
- `nombre` - Nombre del ciclo (I, II, III, etc.)

#### **Tabla: `deportes`**
Cataloga los deportes disponibles.
- `id` - Identificador único
- `nombre` - Nombre del deporte (futsal, basquet, voley, ajedrez, gincana)
- `tiempo_promedio_minutos` - Duración promedio del deporte

#### **Tabla: `equipos`**
Registra los equipos participantes.
- `id` - Identificador único
- `nombre` - Nombre del equipo
- `ciclo_id` - Referencia al ciclo académico
- `deporte_id` - Referencia al deporte
- `email` - Correo de contacto
- `celular` - Teléfono de contacto
- `seccion` - Sección A o B

#### **Tabla: `jugadores`**
Información de los participantes.
- `id` - Identificador único
- `nombre` - Nombre completo
- `sexo` - M, F, O (Masculino, Femenino, Otro)
- `rol` - titular, suplente, capitan
- `codigo_estudiante` - Código único del estudiante
- `dni` - Documento de identidad

#### **Tabla: `eventos`**
Eventos deportivos como inscripciones y competencias.
- `id` - Identificador único
- `nombre` - Nombre del evento
- `fecha_inicio` - Fecha de inicio
- `fecha_fin` - Fecha de finalización

#### **Tabla: `inscripciones`**
Registro de inscripciones de equipos en eventos.
- `id` - Identificador único
- `equipo_id` - Referencia al equipo
- `evento_id` - Referencia al evento
- `cantidad_participantes` - Número de participantes
- `pagado` - Estado de pago (0/1)
- `medio_pago` - Método de pago utilizado
- `tipo_pago` - regular o adicional

#### **Tabla: `vouchers`**
Validación de comprobantes de pago.
- `id` - Identificador único
- `inscripcion_id` - Referencia a la inscripción
- `numero_voucher` - Número del comprobante
- `banco` - Entidad bancaria o método de pago
- `monto` - Cantidad pagada
- `imagen_url` - URL de la imagen del voucher
- `estado` - pendiente, validado, rechazado
- `titular` - Nombre del pagador

#### **Tabla: `enfrentamientos`**
Partidos entre equipos.
- `id` - Identificador único
- `equipo_1_id` - Primer equipo
- `equipo_2_id` - Segundo equipo
- `ganador_id` - Equipo ganador
- `partido_numero` - Número del partido

#### **Tabla: `detalle_partido`**
Información detallada de cada partido.
- `id` - Identificador único
- `partido_id` - Referencia al enfrentamiento
- `estado_id` - Estado del partido
- `evento_id` - Evento al que pertenece
- `fase_id` - Fase del torneo
- `fecha_inicio` - Fecha y hora de inicio
- `fecha_termino` - Fecha y hora de finalización
- `lugar` - Ubicación del partido
- `puntos_equipo_1` - Puntuación del equipo 1
- `puntos_equipo_2` - Puntuación del equipo 2

### Relaciones Importantes

- **Equipos ↔ Jugadores**: Relación muchos a muchos através de `equipo_jugador`
- **Inscripciones ↔ Jugadores**: Relación muchos a muchos através de `inscripcion_jugador`
- **Equipos → Ciclos**: Cada equipo pertenece a un ciclo
- **Equipos → Deportes**: Cada equipo practica un deporte
- **Vouchers → Inscripciones**: Cada voucher valida una inscripción

### Procedimientos Almacenados

- `mostrar_ciclos()` - Lista todos los ciclos disponibles
- `mostrar_equipos(p_evento_id, p_deporte_id)` - Muestra equipos con información detallada
- `verificar_codigo_estudiante(p_codigo, p_ciclo)` - Valida códigos de estudiante
- `verificar_dni(p_dni, p_ciclo)` - Valida documentos de identidad

## 🏗️ Arquitectura del Proyecto

```
src/
├── app.js                 # Configuración principal de Express
├── server.js             # Punto de entrada del servidor
├── config/
│   └── database.js       # Configuración y conexión a MySQL
├── middleware/
│   └── auth.middleware.js # Middleware de autenticación
└── routes/
    ├── index.js          # Rutas principales
    ├── admin.routes.js   # Rutas de administración
    ├── auth.router.js    # Rutas de autenticación
    ├── equipos.router.js # Rutas de equipos
    ├── inscripciones.routes.js # Rutas de inscripciones
    ├── torneo.router.js  # Rutas de torneos
    └── voucher.router.js # Rutas de vouchers

uploads/                  # Directorio de archivos subidos (vouchers)
```

## 🔧 Instalación y Configuración

### Prerrequisitos

- Node.js v22.13.1 o superior
- MySQL 8.0+
- npm o pnpm

### 1. Clonar el repositorio

```bash
git clone [URL_DEL_REPOSITORIO]
cd undc_deportes/server
```

### 2. Instalar dependencias

```bash
npm install
# o
pnpm install
```

### 3. Configurar variables de entorno

Crear archivo `.env` basado en `.env.example`:

```env
# Entorno de ejecución
NODE_ENV=development
HOST=localhost
PORT=3100

# Configuración CORS
CORS=http://localhost:3305

# Configuración de la base de datos
DB_HOST=localhost
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=sistemas_undc_deportes
DB_PORT=3306

# Rutas de carga
UPLOAD_PATH=./uploads/
MAX_FILE_SIZE=5242880
```

### 4. Configurar la base de datos

1. Crear la base de datos MySQL:
```sql
CREATE DATABASE sistemas_undc_deportes;
```

2. Importar el esquema desde `sistemas_undc_deportes.sql`:
```bash
mysql -u tu_usuario -p sistemas_undc_deportes < sistemas_undc_deportes.sql
```

### 5. Crear directorio de uploads

```bash
mkdir uploads
```

### 6. Ejecutar el servidor

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

## 🌐 API Endpoints

### Base URL
```
http://localhost:3100/api
```

### Endpoints Principales

#### **Autenticación**
- `POST /api/admin/login` - Iniciar sesión de administrador
- `POST /api/admin/logout` - Cerrar sesión
- `GET /api/admin/verify` - Verificar token de sesión

#### **Inscripciones**
- `POST /api/inscripciones` - Crear nueva inscripción
- `GET /api/inscripciones/:id` - Obtener inscripción específica
- `PUT /api/inscripciones/:id` - Actualizar inscripción
- `GET /api/inscripciones/evento/:eventId` - Inscripciones por evento

#### **Equipos**
- `POST /api/admin/equipos` - Crear equipo (admin)
- `GET /api/admin/equipos` - Listar equipos
- `PUT /api/admin/equipos/:id` - Actualizar equipo
- `DELETE /api/admin/equipos/:id` - Eliminar equipo

#### **Vouchers**
- `POST /api/vouchers/upload` - Subir comprobante de pago
- `GET /api/admin/vouchers` - Listar vouchers (admin)
- `PUT /api/admin/vouchers/:id/validate` - Validar voucher
- `PUT /api/admin/vouchers/:id/reject` - Rechazar voucher

#### **Torneos**
- `GET /api/admin/torneos` - Información de torneos
- `POST /api/admin/torneos/sorteo` - Realizar sorteo
- `GET /api/admin/torneos/partidos` - Lista de partidos
- `PUT /api/admin/torneos/partidos/:id` - Actualizar resultado

### Códigos de Respuesta

- `200` - Éxito
- `201` - Recurso creado exitosamente
- `400` - Solicitud incorrecta
- `401` - No autorizado
- `403` - Prohibido
- `404` - Recurso no encontrado
- `409` - Conflicto (recurso duplicado)
- `500` - Error interno del servidor

## 🔒 Seguridad

### Medidas Implementadas

- **Helmet**: Configuración de headers de seguridad HTTP
- **CORS**: Control de dominios permitidos
- **JWT**: Tokens seguros para autenticación
- **bcrypt**: Encriptación de contraseñas con salt
- **Validación de archivos**: Restricciones en tipos y tamaños de archivos
- **Sanitización**: Validación y limpieza de datos de entrada
- **Rate limiting**: Control de solicitudes por IP (recomendado implementar)

### Autenticación y Autorización

El sistema utiliza JWT para la autenticación de administradores:

```javascript
// Ejemplo de middleware de autenticación
import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
```

## 📁 Manejo de Archivos

### Vouchers de Pago

El sistema permite la subida de comprobantes de pago (vouchers) con las siguientes características:

- **Tipos permitidos**: JPG, JPEG, PNG
- **Tamaño máximo**: 5MB (configurable en `MAX_FILE_SIZE`)
- **Directorio**: `./uploads/`
- **Nomenclatura**: `voucher-{timestamp}-{random}.{ext}`

### Configuración Multer

```javascript
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000000000);
    const extension = path.extname(file.originalname);
    cb(null, `voucher-${timestamp}-${randomNum}${extension}`);
  }
});
```

## 🔧 Configuración de Base de Datos

### Pool de Conexiones

El sistema utiliza un pool de conexiones MySQL2 para optimizar el rendimiento:

```javascript
const configuracion = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,      // Máximo 10 conexiones simultáneas
  queueLimit: 0,           // Sin límite en la cola
  charset: "utf8mb4",      // Soporte completo UTF-8
  connectTimeout: 60000    // Timeout de 60 segundos
};
```

### Transacciones

Para operaciones que requieren múltiples consultas, el sistema implementa transacciones:

```javascript
export const transaccion = async (consultas) => {
  const poolInstance = await conexion();
  const connection = await poolInstance.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const resultados = [];
    for (const { sql, params = [] } of consultas) {
      const [result] = await connection.execute(sql, params);
      resultados.push(result);
    }
    
    await connection.commit();
    return resultados;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
```

## 🚦 Estados del Sistema

### Estados de Vouchers
- `pendiente` - Subido pero no validado
- `validado` - Aprobado por administrador
- `rechazado` - Rechazado por administrador

### Estados de Partidos
- `pendiente` - Programado pero no jugado
- `en curso` - Actualmente en juego
- `jugado` - Finalizado con resultado
- `cancelado` - Cancelado sin reprogramación
- `postergado` - Aplazado para otra fecha

### Roles de Jugadores
- `capitan` - Capitán del equipo (contacto principal)
- `titular` - Jugador titular
- `suplente` - Jugador suplente

## 📈 Monitoreo y Logs

### Logging con Morgan

El sistema implementa logging HTTP con Morgan en modo desarrollo:

```javascript
app.use(morgan('dev'));
```

### Health Check

Endpoint para verificar el estado del servidor:

```
GET /api
```

Respuesta:
```json
{
  "status": "OK",
  "timestamp": "2025-01-07T11:52:56.000Z",
  "uptime": 3600.123
}
```

## 🐛 Manejo de Errores

### Middleware Global de Errores

```javascript
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
});
```

### Manejo de Rutas No Encontradas

```javascript
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

## 🔄 WebSocket / Socket.io

El sistema está preparado para comunicación en tiempo real usando Socket.io 4.8.1, ideal para:

- Notificaciones en tiempo real de cambios de estado de vouchers
- Actualizaciones de resultados de partidos en vivo
- Notificaciones de nuevas inscripciones
- Chat en tiempo real durante eventos

## 🧪 Testing

### Estructura Recomendada

```
tests/
├── unit/
│   ├── database.test.js
│   ├── auth.test.js
│   └── vouchers.test.js
├── integration/
│   ├── inscripciones.test.js
│   └── equipos.test.js
└── e2e/
    └── complete-flow.test.js
```

### Herramientas Sugeridas

- **Jest** - Framework de testing
- **Supertest** - Testing de API REST
- **MySQL Memory Server** - Base de datos en memoria para tests

## 🚀 Despliegue

### Variables de Producción

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3100
DB_HOST=tu_servidor_mysql
DB_USER=usuario_produccion
DB_PASSWORD=contraseña_segura
```

### Consideraciones de Producción

1. **Reverse Proxy**: Usar Nginx como proxy reverso
2. **HTTPS**: Configurar certificados SSL/TLS
3. **PM2**: Gestor de procesos para Node.js
4. **Backup**: Configurar respaldos automáticos de la base de datos
5. **Monitoreo**: Implementar logging estructurado y métricas

### Script de PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'undc-deportes-api',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    }
  }]
};
```
## Dockerizacion

### 1. Construir imagen
`docker build -t undc-deportes-backend .`

### 2. Ejecutar contenedor
```docker run -d   --name undc-deportes-server   -p 3100:3100   --env-file .env   -v "$(pwd)/uploads:/app/uploads"   --restart unless-stopped   undc-deportes-backend
  ```

### 3. Ver logs
`docker logs -f undc-deportes-server`

### 4. Detener
`docker stop undc-deportes-server`

### 5. Eliminar
`docker rm undc-deportes-server`

## 🤝 Contribución

### Flujo de Trabajo

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Add nueva funcionalidad'`
4. Push rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código

- **ESLint**: Linting de JavaScript
- **Prettier**: Formateo de código
- **Conventional Commits**: Formato de commits
- **JSDoc**: Documentación de funciones

