import { Body, Controller, Post } from '@nestjs/common';
import { AegisAgentService } from './aegis-agent.service';

@Controller('aegis-agent')
export class AegisAgentController {
  constructor(private readonly aegisService: AegisAgentService) {}

  @Post()
  quote(@Body() payload: { prompt: string }) {
    const privateKeySolana =
      '5Kzm3o7f4y3KXgZ5TLVuLGyb8cLbr2YMrcP8cJoc4xWbTqeKXK2C3RhSPcjwkF69mmt5qXnrYyfJGX4ukCujfdZ2'; // add privateKey here
    const privateKeyEVM =
      '0x5ef37b5ac125adcb6de677d1d20d304f7b09508f6c2824c7101b778651d5821d'; // add privateKey here
    return this.aegisService.crossSwapToken(
      { evm: privateKeyEVM, solana: privateKeySolana },
      payload.prompt,
    );
  }

  @Post('sentiment')
  sentiment(@Body() payload: { contract: string }) {
    return this.aegisService.analyzeToken(payload.contract);
  }
}
