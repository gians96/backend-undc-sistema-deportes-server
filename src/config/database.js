// src/config/database.js
import "dotenv/config";
import mysql from "mysql2/promise";

let pool = null;

const configuracion = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  connectTimeout: 60000,
};


export const conexion = async () => {
  try {
    if (!pool) {
      pool = mysql.createPool(configuracion);
      console.log("✅ Conexión a la base de datos inicializada");
    }
    return pool;
  } catch (error) {
    console.error("❌ Error al crear la conexión a la base de datos:", error);
    throw error;
  }
};

export const cerrarConexion = async () => {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      console.log("🔌 Conexión a la base de datos cerrada");
    }
  } catch (error) {
    console.error("❌ Error al cerrar la conexión a la base de datos:", error);
  }
};

export const query = async (sql, params = []) => {
  try {
    const poolInstance = await conexion();
    const [rows] = await poolInstance.execute(sql, params);
    return rows;
  } catch (error) {
    console.error("❌ Error al ejecutar la consulta:", error);
    throw error;
  }
};

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
