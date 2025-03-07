import { Controller, Get } from '@nestjs/common';
import { AegisBotService } from './aegis-bot.service';
import { WalletService } from '@/wallet/wallet.service';

@Controller('aegis-bot')
export class AegisBotController {
  constructor(
    private readonly aegisService: AegisBotService,
    private readonly walletService: WalletService,
  ) {}

  @Get('wallet')
  wallet() {
    return this.walletService.decryptSolanaWallet(
      '12345',
      'ad42b40649a64e663f00b43264728c21:db1289558db2d9ff101c0d18ad1a4de56333b3ee1f86f45ca236d0e1a8570d19f0f810c20cbacafa4c220e6cf6548fa736102e6c0ba627eb323bdfcf2ca807cdd0ad8ea6dc455335023ef71958796c5378a7822a79efa0c2ab96799286ef9455',
    );
  }
}

// {
//   "address": "2CZDtJFSvU9LvdsqpEayGTTi5SbktbfTUPaNWDSaSy8L",
//   "privateKey": "5Kzm3o7f4y3KXgZ5TLVuLGyb8cLbr2YMrcP8cJoc4xWbTqeKXK2C3RhSPcjwkF69mmt5qXnrYyfJGX4ukCujfdZ2",
//   "mnemonic": "humor bonus another news trash emerge actual august ankle endless behind school"
// }

// {
//   "json": "ad42b40649a64e663f00b43264728c21:db1289558db2d9ff101c0d18ad1a4de56333b3ee1f86f45ca236d0e1a8570d19f0f810c20cbacafa4c220e6cf6548fa736102e6c0ba627eb323bdfcf2ca807cdd0ad8ea6dc455335023ef71958796c5378a7822a79efa0c2ab96799286ef9455"
// }
