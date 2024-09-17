import { ethers } from "ethers";
import { SWAP_ABI, ERC20_ABI } from "./ABIs";

const provider = new ethers.WebSocketProvider(
  `wss://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const monitoredAddresses = [
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9", // B0B
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc", //
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
  // "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13", // jaredfromsubway.eth
].map((address) => address.toLowerCase());
const uniswapV2RouterAddress = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

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

provider.on("block", async (blockNumber) => {
  try {
    const block = await provider.getBlock(blockNumber);
    if (block && block.transactions.length > 0) {
      console.log(
        `\t📦 New block: ${blockNumber} | ${block?.transactions.length} txns`
      );
      for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        if (tx?.from && monitoredAddresses.includes(tx.from.toLowerCase())) {
          console.log(
            `\tFrom: ${
              tx.from
            } | ${new Date().toISOString()}\n\t\t\t🔗 Tx Hash: ${txHash}`
          );
          if (
            tx.to &&
            tx.to.toLowerCase() === uniswapV2RouterAddress.toLowerCase()
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
              const token1Address =
                transferLogs[transferLogs?.length - 1].address;

              const [tokenA, tokenB] = await Promise.all([
                getTokenDetails(token0Address),
                getTokenDetails(token1Address),
              ]);

              const amountA =
                Number(swapIface.parseLog(swapLogs[0])?.args[1]) === 0
                  ? Number(swapIface.parseLog(swapLogs[0])?.args[2]) /
                    Number(Math.pow(10, Number(tokenA.decimals)))
                  : Number(swapIface.parseLog(swapLogs[0])?.args[1]) /
                    Number(Math.pow(10, Number(tokenA.decimals)));
              const amountB =
                Number(
                  swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]
                ) === 0
                  ? Number(
                      swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[3]
                    ) / Number(Math.pow(10, Number(tokenB.decimals)))
                  : Number(
                      swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]
                    ) / Number(Math.pow(10, Number(tokenB.decimals)));
              console.log("---------------------------------");
              console.log(`\t\t\t✅ Swap Detected!`);
              console.log(`\t\t\t🔗 Tx: https://etherscan.io/tx/${tx.hash}\n`);
              console.log(
                `\t\t\t💱 Swap: ${amountA} 🪙  ${tokenA.symbol.toUpperCase()}` +
                  ` -> ${amountB} 🪙  ${tokenB.symbol.toUpperCase()}`
              );
              console.log(
                `\t\t\t  |_${tokenA.tokenName}:\t` +
                  `Supply: ${tokenA.supply}\t(${tokenA.decimals})`
              );
              console.log(
                `\t\t\t  |_${tokenB.tokenName}:\t` +
                  `Supply: ${tokenB.supply}\t(${tokenB.decimals})`
              );

              console.log(`\t\t\tValue: ${ethers.formatEther(tx.value)} ETH`);
              console.log("---------------------------------");
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error processing transaction: ${e.message}`);
  }
});

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
