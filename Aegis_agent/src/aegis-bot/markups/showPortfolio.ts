export const showPortfolioMarkup = async (data: any) => {
  return {
    message: `<b>Your Portfolio:</b>:\n\n<b>➤ MNT :</b>\n - Balance: ${data.mnt.mntBalance} MNT\n - Value: ${data.mnt.value} $\n - Price: ${data.mnt.price}\n\n<b>➤ USDC :</b>\n - Balance: ${data.usdc.usdcBalance} USDC\n - Value: ${data.usdc.value} $\n - Price: ${data.usdc.price}\n\n<b>➤ USDT :</b>\n - Balance: ${data.usdt.usdtBalance} USDT\n - Value: ${data.usdt.value} $\n - Price: ${data.usdt.price}\n\n<b>➤ MOE :</b>\n - Balance: ${data.moe.moeBalance} MOE\n - Value: ${data.moe.value} $\n - Price: ${data.moe.price}`,
    keyboard: [
      [
        {
          text: 'Close ❌',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
