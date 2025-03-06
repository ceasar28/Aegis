import { Test, TestingModule } from '@nestjs/testing';
import { AegisBotService } from './aegis-bot.service';

describe('AegisBotService', () => {
  let service: AegisBotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AegisBotService],
    }).compile();

    service = module.get<AegisBotService>(AegisBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
