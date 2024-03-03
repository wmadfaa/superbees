import { faker } from "@faker-js/faker";
import { ethers } from "ethers";

import { Blockchain } from "../types";

function generateEvmWallet() {
  const mnemonic = ethers.Mnemonic.fromEntropy(ethers.randomBytes(16));
  const wallet = ethers.Wallet.fromPhrase(mnemonic.phrase);
  const password = faker.internet.password({ length: faker.number.int({ min: 12, max: 23 }), memorable: true });

  return {
    type: Blockchain.EVM,
    publicKey: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase,
    password,
  };
}

export default generateEvmWallet;
