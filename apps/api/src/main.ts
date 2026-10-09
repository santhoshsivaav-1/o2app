import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin.split(","), credentials: true });
  app.setGlobalPrefix("api/v1");

  const config = new DocumentBuilder()
    .setTitle("Gym Management API")
    .setVersion("v1")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app as any, doc);

  const port = Number(process.env.PORT ?? process.env.PORT_API ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}
bootstrap();
