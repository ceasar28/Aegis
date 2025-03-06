import { Test, TestingModule } from '@nestjs/testing';
import { RebalancrAgentController } from './aegis-agent.controller';

describe('RebalancrAgentController', () => {
  let controller: RebalancrAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RebalancrAgentController],
    }).compile();

    controller = module.get<RebalancrAgentController>(RebalancrAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
