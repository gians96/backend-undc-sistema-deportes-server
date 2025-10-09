# Imagen base de Node.js 22 Alpine (ligera)
FROM node:22-alpine

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev && \
    npm cache clean --force

# Cambiar propiedad del directorio antes de copiar archivos
RUN chown -R nodejs:nodejs /app

# Cambiar a usuario no-root
USER nodejs

# Copiar código fuente
COPY --chown=nodejs:nodejs ./src ./src

# Crear directorio para uploads (los archivos persistirán con volúmenes)
RUN mkdir -p uploads

# Exponer puerto (configurable via variable de entorno)
#EXPOSE 3100

# Variables de entorno por defecto (se sobrescriben con .env o docker-compose)
#ENV NODE_ENV=production 
#   \
#    PORT=3100 \
#    HOST=0.0.0.0

# Health check para verificar que el servidor está funcionando
#HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
 #CMD node -e "require('http').get('http://localhost:${PORT}/api', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Comando de inicio con dumb-init para manejo de señales
CMD ["dumb-init", "node", "src/server.js"] 