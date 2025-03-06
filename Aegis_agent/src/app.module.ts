import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AegisModule } from './aegis-bot/aegis-bot.module';
import { DatabaseModule } from './database/database.module';
import { WalletModule } from './wallet/wallet.module';
import { AegisAgentModule } from './aegis-agent/aegis-agent.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    AegisModule,
    DatabaseModule,
    WalletModule,
    AegisAgentModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
