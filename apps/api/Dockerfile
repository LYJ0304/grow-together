FROM gradle:9.7.1-jdk21 AS build
WORKDIR /workspace/apps/api
COPY apps/api/gradle gradle
COPY apps/api/gradlew apps/api/build.gradle apps/api/settings.gradle ./
RUN ./gradlew dependencies --no-daemon
COPY apps/api/src src
COPY contracts/openapi.yaml /workspace/contracts/openapi.yaml
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/apps/api/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
