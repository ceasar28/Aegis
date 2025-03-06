import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { AegisBotService } from './aegis-bot.service';
import type { Response } from 'express'; //

@Controller('aegis-bot')
export class AegisBotController {
  constructor(private readonly aegisService: AegisBotService) {}

  @Post('link')
  linkToBot(@Body() payload: { uniqueCode: string }) {
    return this.aegisService.linkBotToApp(payload.uniqueCode);
  }

  @Get('profile-photo/:id')
  // @Header('content-type', 'image/jpeg')
  async getMedia(
    @Param('id') id: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      console.log('query  :', id);
      const response = await this.aegisService.getProfilePhoto(id);
      if (response.buffer) {
        res.setHeader('content-type', 'image/jpeg');
        res.send(response.buffer);
      }
    } catch (error) {
      console.log(error);
    }
  }
}
