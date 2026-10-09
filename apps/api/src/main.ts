import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./config.js";

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: env.webOrigins, credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const config = new DocumentBuilder()
    .setTitle("Gym Management API")
    .setVersion("v1")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app as any, doc);

  await app.listen(env.port);
  // eslint-disable-next-line no-console
  console.log(`api listening on :${env.port}`);
}
bootstrap();
