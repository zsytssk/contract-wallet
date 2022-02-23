import unit from "ethjs-unit";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import Web3Utils from "web3-utils";

import { getQueryParams } from "./utils";
import WalletConnectProvider from "@walletconnect/web3-provider";

import { ChainType, WalletError } from ".";
import { contractApiDataFn, genAllowance } from "./contractApiDataFn";
import { defaultAbi } from "./testData";
import { getContractBalance } from "./utils";

const ethBrowser = {
  "0x1": "https://etherscan.io",
  "0x3": "https://ropsten.etherscan.io",
  "0x2a": "https://kovan.etherscan.io",
  "0x4": "https://rinkeby.etherscan.io",
  "0x5": "https://goerli.etherscan.io/",
};

const BNBConfig = {
  "0x61": {
    chainId: "0x61",
    chainName: "Binance Smart Chain - Testnet",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  "0x38": {
    chainId: "0x38",
    chainName: "Binance Smart Chain",
    rpcUrls: ["https://bsc-dataseed.binance.org/"],
    blockExplorerUrls: ["https://bscscan.com"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
};

export default class WalletConnect {
  name = "WalletConnect";
  icon = require("@/assets/wallet-icons/wallet-connect.svg");
  provider = null;
  supportChain = ["ETH", "BNB"];
  supportCurrencies = ["ETH", "BNB"];
  currentSupportCurrencies: string[] | null = null;
  private _isEnabled = false;
  private _address = "";
  private _enabledCurrency: ChainType | null = null;
  private ethereum: WalletConnectProvider | null = null;
  private _web3: Web3 | null = null;
  private _contract: Contract | null = null;
  constructor() {
    (window as any).WalletConnectWallet = this;
    (window as any).Web3Utils = Web3Utils;
  }
  async logout() {
    await this.ethereum?.disconnect();
    this.ethereum = null;
    this._enabledCurrency = null;
    this._isEnabled = false;
    this._address = "";
  }
  get browser(): { name: string; url: string } {
    if (!this._enabledCurrency || !this._address || !this.ethereum)
      return { name: "", url: "" };
    let name: string, browser: string;
    if (this._enabledCurrency === "BNB") {
      name = "BscScan";
      const { blockExplorerUrls } =
        BNBConfig[Web3Utils.numberToHex(this.ethereum.chainId)];
      browser = blockExplorerUrls[0];
    } else {
      name = "Etherscan";
      browser = ethBrowser[Web3Utils.numberToHex(this.ethereum.chainId)] || "";
    }
    return { name, url: `${browser}/address/${this._address}` };
  }

  get address() {
    return this._address;
  }
  async changeCurrency(currencyInfo: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;

    if (currency === this._enabledCurrency) {
      return WalletError.SUCCESS;
    }
    const ethereum = this.ethereum;

    if (!ethereum || !this._web3) {
      return WalletError.FAIL;
    }

    if (currencyInfo?.token) {
      this._contract = new this._web3.eth.Contract(
        defaultAbi as any,
        currencyInfo.token
      );
    } else {
      this._contract = null;
    }

    if (currency === "BNB") {
      if (
        !Object.keys(BNBConfig).includes(
          Web3Utils.numberToHex(ethereum.chainId)
        )
      ) {
      }
    } else {
      if (
        !Object.keys(ethBrowser).includes(
          Web3Utils.numberToHex(ethereum.chainId)
        )
      ) {
      }
    }
    this._enabledCurrency = currency;
    return WalletError.SUCCESS;
  }
  async enable(currencyInfo?: any) {
    const result = await this._enable(currencyInfo);
    if (result !== WalletError.SUCCESS) {
      this.logout();
    }
    return result;
  }
  private async _enable(currencyInfo: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;

    if (this._isEnabled && this._address) {
      return WalletError.SUCCESS;
    }
    const bridgeUrl = await getBridgeUrl();

    if (!bridgeUrl) {
      return WalletError.FAIL;
    }
    const paramsId = getQueryParams("walletConnectId");
    let id = 1;
    if (paramsId) {
      id = paramsId;
    } else if (chain === "BNB") {
      id = 56;
    }
    const rpc = getRpc(id);
    const ethereum = new WalletConnectProvider({
      // eslint-disable-next-line no-restricted-globals
      bridge: `${location.protocol}//${bridgeUrl}`,
      chainId: id,
      rpc: {
        "1": "https://mainnet.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
        "3": "https://ropsten.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
        "4": "https://rinkeby.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
        "5": "https://goerli.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
        "42": "https://kovan.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
        "56": "https://bsc-dataseed.binance.org/",
        "97": "https://data-seed-prebsc-1-s1.binance.org:8545/",
        [id]: rpc,
      },
      qrcodeModalOptions: {
        mobileLinks: [
          "rainbow",
          "metamask",
          "argent",
          "trust",
          "imtoken",
          "pillar",
        ],
      },
    });
    if (ethereum) {
      this.ethereum = ethereum;
      this._isEnabled = true;
      this._web3 = new Web3(ethereum as any);
      this._enabledCurrency = currency;

      if (currencyInfo?.token) {
        this._contract = new this._web3.eth.Contract(
          defaultAbi as any,
          currencyInfo.token
        );
      } else {
        this._contract = null;
      }

      try {
        const [address] = await ethereum.enable();
        if (currency === "BNB") {
          if (
            !Object.keys(BNBConfig).includes(
              Web3Utils.numberToHex(ethereum.chainId)
            )
          ) {
            this.logout();
            return WalletError.WALLET_CONNECT_CHAIN_ERROR;
          }
          this.currentSupportCurrencies = ["BNB"];
        } else {
          if (
            !Object.keys(ethBrowser).includes(
              Web3Utils.numberToHex(ethereum.chainId)
            )
          ) {
            this.logout();
            return WalletError.WALLET_CONNECT_CHAIN_ERROR;
          }
          this.currentSupportCurrencies = ["ETH"];
        }
        if (address) {
          this._address = address;
          return WalletError.SUCCESS;
        }
        return WalletError.USER_NOT_LOGGED;
      } catch (error: any) {
        if (error.code === 4001) {
          return WalletError.USER_REJECTED_LOGIN;
        }
        return WalletError.USER_NOT_LOGGED;
      }
    }
    return WalletError.NOT_FOUND;
  }
  async getBalance(): Promise<{ status: WalletError; balance?: number }> {
    if (!this._address) {
      return { status: WalletError.USER_NOT_LOGGED };
    }
    let balance = 0;
    try {
      if (this._contract) {
        balance = await getContractBalance(this._contract, this._address);
      } else {
        const rawBalance = await this.ethereum?.request({
          method: "eth_getBalance",
          params: [this._address, "latest"],
        });
        balance = Number(unit.fromWei(rawBalance, "ether"));
      }
    } catch (error) {
      console.log("WalletConnect.getBalance catch error.", error);
    }
    return { status: WalletError.SUCCESS, balance };
  }
  async transaction(
    address: string,
    value: number,
    order: any,
    currencyInfo?: any
  ): Promise<WalletError> {
    if (!this._address || !this._web3) {
      return WalletError.USER_NOT_LOGGED;
    }
    try {
      const isToken = Boolean(currencyInfo?.token);
      const transactionValue = isToken ? "0" : value;
      const { _web3 } = this;

      console.log(`test:>walletConnect:>0`);
      if (isToken) {
        const isApprove = await this.contractApprove(address, value);
        if (!isApprove) {
          return WalletError.FAIL;
        }
      }

      console.log(`test:>walletConnect:>1`);

      const data = await contractApiDataFn(_web3, {
        value,
        order,
        address,
        token: currencyInfo?.token,
        transferContract: this._contract,
      });
      console.log(`test:>walletConnect:>2`, data);
      const hash = await new Promise((resolve, reject) => {
        _web3.eth.sendTransaction(
          {
            from: this._address,
            to: address,
            value: `0x${unit.toWei(transactionValue, "ether").toString(16)}`,
            data,
          },
          (err: any, data: any) => {
            if (err) {
              return reject(err);
            }
            resolve(data);
          }
        );
      });
      return WalletError.SUCCESS;
    } catch (error) {
      console.log(
        "ethereum.request method:eth_sendTransaction catch error.",
        error
      );
      return WalletError.FAIL;
    }
  }
  async contractApprove(toAddress: string, amount: number) {
    const { _contract, _web3, _address } = this;
    if (!_contract || !_web3) {
      return false;
    }
    const allow = await _contract.methods.allowance(_address, toAddress).call();

    const _amount = _web3.utils.toWei(amount + "");
    // console.log(`test:>approve:>allow=${allow}|amount=${amount}`);
    if (_amount <= allow) {
      return true;
    }
    const allowAmount = genAllowance(amount);
    // console.log(`test:>approve:>_amount <= allow`, allowAmount);
    return await _contract.methods
      .approve(toAddress, _web3.utils.toWei(allowAmount + ""))
      .send({ from: _address })
      .then((data: any) => {
        return true;
      })
      .catch((err: any) => {
        return false;
      });
  }

  async signature(message: string): Promise<string | null> {
    if (!this.ethereum) return null;
    try {
      const signature: string = await this.ethereum.request({
        method: "personal_sign",
        params: [Web3Utils.utf8ToHex(message), this._address],
      });
      return signature;
    } catch (error) {
      return null;
    }
  }
}

async function getBridgeUrl() {
  const rep = await request(`/getWalletBridgeUrl`, "GET", null);
  if (rep.rspCode === "0000") {
    const list = rep.data.list;

    const tmpUrl = getWalletConnectTmpUrl();
    if (tmpUrl && list.indexOf(tmpUrl) === -1) {
      localStorage.removeItem("walletconnect");
    }

    let saveUrl = localStorage.getItem("walletConnectBridgeUrl");
    if (!saveUrl || list.indexOf(saveUrl) === -1) {
      saveUrl = list[Math.floor(Math.random() * list.length)];
      localStorage.setItem("walletConnectBridgeUrl", saveUrl as string);
    }
    return saveUrl;
  }
}

function getWalletConnectTmpUrl() {
  try {
    const tmpStr = localStorage.getItem("walletconnect");
    if (tmpStr) {
      const tmpData = JSON.parse(tmpStr);
      const url = tmpData.bridge || "";
      return url.replace("http://", "").replace("https://", "");
    } else {
      return "";
    }
  } catch (err) {
    return "";
  }
}

function getRpc(id: number) {
  const map = {
    "0x1": "https://mainnet.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
    "0x3": "https://ropsten.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
    "0x4": "https://rinkeby.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
    "0x5": "https://goerli.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
    "0x2a": "https://kovan.infura.io/v3/c56795a9f75e42c6b738597e0532d46d",
    "0x38": [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/",
      "https://bsc-dataseed2.defibit.io/",
      "https://bsc-dataseed3.defibit.io/",
      "https://bsc-dataseed4.defibit.io/",
      "https://bsc-dataseed2.ninicoin.io/",
      "https://bsc-dataseed3.ninicoin.io/",
      "https://bsc-dataseed4.ninicoin.io/",
      "https://bsc-dataseed1.binance.org/",
      "https://bsc-dataseed2.binance.org/",
      "https://bsc-dataseed3.binance.org/",
      "https://bsc-dataseed4.binance.org/",
    ],
    "0x61": [
      "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://data-seed-prebsc-1-s2.binance.org:8545/",
      "https://data-seed-prebsc-2-s2.binance.org:8545/",
      "https://data-seed-prebsc-1-s3.binance.org:8545/",
      "https://data-seed-prebsc-2-s3.binance.org:8545/",
    ],
  };
  const item = map[Web3Utils.numberToHex(id)];
  if (typeof item === "string") {
    return item;
  }
  return item[Math.floor(Math.random() * item.length)];
}
