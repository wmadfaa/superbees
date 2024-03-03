import { faker } from "@faker-js/faker";

import * as bip39 from "bip39";
import { Keypair } from "@solana/web3.js";

import { Blockchain } from "../types";

function generateSolWallet() {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const keypair = Keypair.fromSeed(seed.subarray(0, 32));
  const password = faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }), memorable: true });

  return {
    type: Blockchain.SOLANA,
    publicKey: keypair.publicKey.toString(),
    privateKey: keypair.secretKey,
    mnemonic,
    password,
  };
}

export default generateSolWallet;
