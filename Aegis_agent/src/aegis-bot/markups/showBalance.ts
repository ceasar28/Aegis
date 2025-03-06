export const showBalanceMarkup = async (
  mntBalance: number,
  usdcBalance: number,
  usdtBalance: number,
  wmntBalance: number,
  moeBalance: number,
) => {
  return {
    message: `<b>Wallet Balance:</b>:\n\n➤ ${mntBalance} <b>MNT</b>\n➤ ${usdcBalance} <b>USDC</b>\n➤ ${usdtBalance} <b>USDT</b>\n➤ ${wmntBalance} <b>WMNT</b>\n➤ ${moeBalance} <b>MOE</b>`,
    keyboard: [
      [
        {
          text: 'Fund wallet 💵',
          callback_data: JSON.stringify({
            command: '/fundWallet',
            language: 'english',
          }),
        },
      ],
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
