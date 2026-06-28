import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { env } from "./core/env";
import { UPLOADS_DIR } from "./core/uploads";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: env.BASE_FRONT_URL,
    credentials: true,
  });

  // Serve uploaded files at /uploads/* — outside the /api prefix on purpose so
  // direct browser <a> downloads work without needing the JWT.
  app.useStaticAssets(UPLOADS_DIR, { prefix: "/uploads/" });

  app.setGlobalPrefix("api");

  await app.listen(env.PORT);
  console.log(`[ft_root] API listening on http://localhost:${env.PORT}`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
