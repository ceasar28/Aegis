import { Test, TestingModule } from '@nestjs/testing';
import { AegisBotController } from './aegis-bot.controller';

describe('AegisBotController', () => {
  let controller: AegisBotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AegisBotController],
    }).compile();

    controller = module.get<AegisBotController>(AegisBotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
