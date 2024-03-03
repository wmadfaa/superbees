import { Blockchain } from "./types";

import generateEvmWallet from "./chains/evm";
import generateSolanaWallet from "./chains/solana";

export * from "./types";

export function generateWallet(chain: Blockchain) {
  switch (chain) {
    case Blockchain.EVM:
      return generateEvmWallet();
    case Blockchain.SOLANA:
      return generateSolanaWallet();
    default:
      throw new Error(`Unsupported blockchain type: ${chain}`);
  }
}
