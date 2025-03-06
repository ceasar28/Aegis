import { Module } from '@nestjs/common';
import { AegisAgentService } from './aegis-agent.service';
import { AegisAgentController } from './aegis-agent.controller';

@Module({
  exports: [AegisAgentService],
  providers: [AegisAgentService],
  controllers: [AegisAgentController],
})
export class AegisAgentModule {}
