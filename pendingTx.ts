import { ethers } from "ethers";
import { SWAP_ABI, ERC20_ABI, POOL_ABI } from "./ABIs";

const provider = new ethers.WebSocketProvider(
  `wss://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const monitoredAddress = [
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9",
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc",
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
  "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13",
].map((address) => address.toLowerCase());

const processedTransactions = new Set<string>();
const pendingTransactionsTime = new Map<string, number>();
const swapIface = new ethers.Interface(SWAP_ABI);

async function getTokenDetails(tokenAddress: string) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [tokenName, symbol, decimals, totalSupply] = await Promise.all([
    tokenContract.name(),
    tokenContract.symbol(),
    tokenContract.decimals(),
    tokenContract.totalSupply(),
  ]);

  const formattedSupply = Number(ethers.formatUnits(totalSupply, decimals));

  return {
    tokenName: tokenName || "Unknown",
    symbol: symbol || "Unknown",
    supply: formattedSupply || 0,
    decimals: decimals || 18,
    address: tokenAddress,
  };
}

async function checkPendingTransactions() {
  const pendingTransactions = await provider.send("eth_subscribe", [
    "newPendingTransactions",
  ]);

  // Comment this part for pending tx
  if (pendingTransactions && pendingTransactions.transactions) {
    for (const tx of pendingTransactions.transactions) {
      if (
        monitoredAddress.includes(tx.from.toLowerCase()) &&
        !processedTransactions.has(tx.hash)
      ) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        const transferEventTopic =
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
        const swapEventTopic =
          "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

        const transferLogs = receipt?.logs.filter(
          (log) => log.topics[0] === transferEventTopic
        );
        const swapLogs = receipt?.logs.filter(
          (log) => log.topics[0] === swapEventTopic
        );
        if (transferLogs && swapLogs) {
          const token0Address = transferLogs[0].address;
          const token1Address = transferLogs[transferLogs?.length - 1].address;

          const [tokenA, tokenB] = await Promise.all([
            getTokenDetails(token0Address),
            getTokenDetails(token1Address),
          ]);

          const amountA =
            Number(swapIface.parseLog(swapLogs[0])?.args[1]) /
            Number(Math.pow(10, Number(tokenA.decimals)));
          const amountB =
            Number(swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]) /
            Number(Math.pow(10, Number(tokenB.decimals)));

          console.log(`✅ Swap Detected!`);
          console.log(
            `- Swap: ${amountA} ${tokenA.symbol.toUpperCase()}` +
              ` -> ${amountB} ${tokenB.symbol.toUpperCase()}`
          );
          console.log(
            `  |_${tokenA.tokenName}:\t` +
              `Supply: ${tokenA.supply}\t(${tokenA.decimals})`
          );
          console.log(
            `  |_${tokenB.tokenName}:\t` +
              `Supply: ${tokenB.supply}\t(${tokenB.decimals})`
          );

          console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
          console.log(`🔗 Tx: https://etherscan.io/tx/${tx.hash}`);
          console.log("---------------------------------");
        }
      }
    }
  }
}

function animateMonitoringMessage() {
  const messages = [
    "🔍 Monitoring wallet   ",
    "🔍 Monitoring wallet.  ",
    "🔍 Monitoring wallet.. ",
    "🔍 Monitoring wallet...",
  ];
  let index = 0;

  setInterval(() => {
    process.stdout.write(`\r${messages[index]}`);
    index = (index + 1) % messages.length;
  }, 1000);
}

animateMonitoringMessage();
checkPendingTransactions();

setInterval(checkPendingTransactions, 1000);
