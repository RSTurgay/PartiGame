# Parti Game: tek imaj. Frontend derlenip Spring Boot'un static klasörüne gömülür,
# Spring Boot hem sayfayı hem WebSocket'i (/ws) aynı porttan sunar.

# 1) Frontend (React + Three.js)
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# vite.config.ts çıktıyı ../backend/src/main/resources/static'e yazar
RUN npm run build

# 2) Backend (Spring Boot, Maven)
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -q dependency:go-offline
COPY backend/src ./src
COPY --from=frontend /app/backend/src/main/resources/static ./src/main/resources/static
RUN mvn -q -DskipTests package

# 3) Çalışma imajı
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=backend /app/backend/target/partigame-backend-*.jar app.jar
# Ücretsiz sunucular 512 MB bellek verir; JVM'i buna göre sınırla.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
