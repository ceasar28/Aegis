import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { parseAbiItem } from 'viem';

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const unwatch = publicClient.watchEvent({
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  event: parseAbiItem(
    'event TokenCreate(address creator, address token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime)',
  ),
  onLogs: (logs) => console.log(logs),
});

console.log(unwatch);
