import { Module } from '@nestjs/common';
import { AegisBotService } from './aegis-bot.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../database/schemas/user.schema';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { Session, SessionSchema } from 'src/database/schemas/session.schema';
import { AegisAgentModule } from 'src/aegis-agent/aegis-agent.module';
import { AegisBotController } from './aegis-bot.controller';

@Module({
  imports: [
    DatabaseModule,
    HttpModule,
    AegisAgentModule,
    WalletModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  providers: [AegisBotService],
  controllers: [AegisBotController],
})
export class AegisModule {}
