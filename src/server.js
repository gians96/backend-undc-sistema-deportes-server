// src/server.js
import { createServer } from 'http';
import app from './app.js';
import { conexion, cerrarConexion } from './config/database.js';
import 'dotenv/config';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const server = createServer(app);

function printStartupBanner() {
  const separator = '='.repeat(60);
  const url = `http://${HOST}:${PORT}`;

  console.log('\n' + separator);
  console.log('🚀 SERVIDOR BACKEND INICIADO');
  console.log(separator);
  console.log(' - Fecha/Hora     :', new Date().toLocaleString());
  console.log(' - Host           :', HOST);
  console.log(' - Puerto         :', PORT);
  console.log(' - URL            :', url);
  console.log(' - Base de datos  :', process.env.DB_NAME);
  console.log(' - CORS           :', process.env.CORS);
  console.log(separator + '\n');
}

async function iniciarServidor() {
  try {
    await conexion(); // Conexión a DB

    server.listen(PORT, HOST, () => {
      printStartupBanner();
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Apagando servidor...');
      await cerrarConexion();
      server.close(() => {
        console.log('👋 Servidor cerrado correctamente');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

iniciarServidor();
