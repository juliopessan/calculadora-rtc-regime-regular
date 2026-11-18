# Imagem do motor oficial, versão fixada pelo commit do fork. Build a partir da raiz do fork:
#   docker build -f auditor-rtc/engine/Dockerfile -t auditor-engine:1.6.1 .
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY . .
RUN mkdir -p calculadora/db \
 && ./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors -q \
 && ./mvnw -DskipTests package --batch-mode -q

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar /app/engine.jar
COPY --from=build /src/calculadora/db /app/calculadora/db
COPY --from=build /src/LICENSE /app/LICENSE
COPY auditor-rtc/engine/NOTICE /app/NOTICE
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/engine.jar", "--spring.profiles.active=offline"]
