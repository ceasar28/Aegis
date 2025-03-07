import { Body, Controller, Get, Post } from '@nestjs/common';
import { AegisAgentService } from './aegis-agent.service';

@Controller('aegis-agent')
export class AegisAgentController {
  constructor(private readonly aegisService: AegisAgentService) { }

  @Post()
  quote(@Body() payload: { prompt: string }) {
    const privateKeySolana = ''; // add privateKey here
    const privateKeyEVM = ''; // add privateKey here
    return this.aegisService.crossSwapToken({ evm: privateKeyEVM, solana: privateKeySolana }, payload.prompt);
  }

  @Post('sentiment')
  sentiment(@Body() payload: { contract: string }) {
    return this.aegisService.analyzeToken(payload.contract);
  }
}
