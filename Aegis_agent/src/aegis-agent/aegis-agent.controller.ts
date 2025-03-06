import { Body, Controller, Get, Post } from '@nestjs/common';
import { AegisAgentService } from './aegis-agent.service';

@Controller('aegis-agent')
export class AegisAgentController {
  constructor(private readonly aegisService: AegisAgentService) {}

  @Get()
  quote() {
    return this.aegisService.crossSwapToken();
  }

  @Post('sentiment')
  sentiment(@Body() payload: { contract: string }) {
    return this.aegisService.analyzeToken(payload.contract);
  }
}
