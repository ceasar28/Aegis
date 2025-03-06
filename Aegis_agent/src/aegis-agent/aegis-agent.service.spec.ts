import { Test, TestingModule } from '@nestjs/testing';
import { AegisAgentService } from './aegis-agent.service';

describe('AegisAgentService', () => {
  let service: AegisAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AegisAgentService],
    }).compile();

    service = module.get<AegisAgentService>(AegisAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
