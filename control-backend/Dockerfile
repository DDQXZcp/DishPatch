FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Create a non-root user for running the backend.
RUN groupadd --system dishpatch \
    && useradd \
        --system \
        --gid dishpatch \
        --home-dir /app \
        --shell /usr/sbin/nologin \
        dishpatch

# The GitHub workflow places the Maven-built JAR in target/.
ARG JAR_FILE=target/dishpatch-control-backend-1.0.0.jar

COPY --chown=dishpatch:dishpatch ${JAR_FILE} /app/app.jar

ENV SERVER_PORT=8081
ENV SERVER_ADDRESS=0.0.0.0

EXPOSE 8081

USER dishpatch

ENTRYPOINT ["java", "-jar", "/app/app.jar"]