import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

function getJwtSecretOrThrow() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  if (jwtSecret === 'super-secret-change-me') {
    throw new Error('JWT_SECRET is using an insecure default value');
  }

  return jwtSecret;
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecretOrThrow(),
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
