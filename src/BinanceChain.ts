import unit from "ethjs-unit";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import Web3Utils from "web3-utils";

import { ChainType, WalletError } from ".";
import { contractApiDataFn, genAllowance } from "./contractApiDataFn";
import { defaultAbi } from "./testData";
import { getContractBalance } from "./utils";

const Config = {
  ETH: {
    chainIds: ["0x01"],
    networkIds: ["eth-mainnet"],
    browser: {
      name: "Etherscan",
      urls: ["https://etherscan.io"],
    },
  },
  BNB: {
    chainIds: ["0x38", "0x61"],
    networkIds: ["bsc-mainnet", "bsc-testnet"],
    browser: {
      name: "BscScan",
      urls: ["https://bscscan.com", "https://testnet.bscscan.com"],
    },
  },
};

class BinanceChainWallet {
  name = "Binance Chain Wallet";
  provider = "https://metamask.io/";
  supportChain = ["ETH", "BNB"];
  supportCurrencies = ["ETH", "BNB"];
  private _isEnabled = false;
  private _address = "";
  private _enabledCurrency: ChainType | null = null;
  private _enabledChain: string | null = null;
  private _web3: Web3 | null = null;
  private _contract: Contract | null = null;
  private removeAllListenFn: null | (() => void) = null;
  constructor() {
    (window as any).BinanceChainWallet = this;

    const BinanceChain: any = (window as any).BinanceChain;
    if (!BinanceChain) {
      console.warn("No BSC provider was found on window.BinanceChain.");
      return;
    }
  }

  get browser(): { name: string; url: string } {
    if (!this._enabledChain) return { name: "", url: "" };
    const { name, urls } = Config[this._enabledChain].browser;
    let url: string;
    if (this._enabledChain === "BNB") {
      url = urls[__isDEV__ ? 1 : 0];
    } else {
      url = urls[0];
    }
    return { name, url: `${url}/address/${this._address}` };
  }

  get address() {
    return this._address;
  }

  logout() {
    this.removeAllListenFn?.();
    this.removeAllListenFn = null;
    this._enabledCurrency = null;
    this._enabledChain = null;
    this._isEnabled = false;
    this._address = "";
  }

  onEnable() {
    const BinanceChain: any = (window as any).BinanceChain;
    if (!BinanceChain) {
      return;
    }

    BinanceChain.autoRefreshOnNetworkChange = false;
    const chainChangedListenFn = (chainId: string) => {
      console.log(
        "BinanceChain chainChanged",
        chainId
      ); /* window.location.reload() */
      let chain: ChainType;
      if (Config.BNB.chainIds.includes(chainId)) {
        chain = "BNB";
      } else if (Config.ETH.chainIds.includes(chainId)) {
        chain = "ETH";
      } else {
        console.warn("BinanceChain chanId not support!");
        return;
      }
      const currency = chain;
      window.dispatchEvent(
        new CustomEvent("bitgame_wallet_chain_changed", {
          detail: { currency },
        })
      );
    };
    const accountsChangedListenFn = (accounts: any) => {
      console.log("BinanceChain accountsChanged.", accounts);
      window.location.reload();
    };
    BinanceChain.on("chainChanged", chainChangedListenFn);
    BinanceChain.on("accountsChanged", accountsChangedListenFn);

    this.removeAllListenFn = () => {
      // BinanceChain.removeListener('chainChanged', chainChangedListenFn);
      // BinanceChain.removeListener('accountsChanged', accountsChangedListenFn);
    };
  }
  async changeCurrency(currencyInfo?: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;
    console.log(`test:>changeCurrency`, chain, currency);

    if (!this._web3) {
      return WalletError.FAIL;
    }
    const BinanceChain: any = (window as any).BinanceChain;
    if (!BinanceChain) {
      return WalletError.NOT_FOUND;
    }
    if (currency === this._enabledCurrency) {
      return WalletError.SUCCESS;
    }

    if (currencyInfo?.token) {
      this._contract = new this._web3.eth.Contract(
        defaultAbi as any,
        currencyInfo.token
      );
    } else {
      this._contract = null;
    }

    this.removeAllListenFn?.();
    this.removeAllListenFn = null;

    const { chainIds, networkIds } = Config[chain];
    if (!chainIds.includes(BinanceChain.chainId)) {
      let networkId: string;
      if (chain === "BNB") {
        networkId = networkIds[__isDEV__ ? 1 : 0];
      } else {
        networkId = networkIds[0];
      }
      try {
        await BinanceChain.switchNetwork(networkId);
      } catch (error: any) {
        console.log("BinanceChain.switchNetwork catch error.", error);
        if (error.error === "user rejected") {
          return WalletError.USER_REJECTED_LOGIN;
        } else {
          return WalletError.FAIL;
        }
      }
    }
    this._enabledCurrency = currency;
    this._enabledChain = chain;
    this.onEnable();
    return WalletError.SUCCESS;
  }
  async enable(currencyInfo?: any) {
    const result = await this._enable(currencyInfo);
    if (result !== WalletError.SUCCESS) {
      this.logout();
    }
    return result;
  }
  private async _enable(currencyInfo?: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;
    console.log(`test:>enable`, chain, currency);
    if (this._isEnabled && this._address) {
      return WalletError.SUCCESS;
    }
    const BinanceChain: any = (window as any).BinanceChain;
    if (!BinanceChain) return WalletError.NOT_FOUND;

    this._web3 = new Web3(BinanceChain);
    if (currencyInfo?.token) {
      this._contract = new this._web3.eth.Contract(
        defaultAbi as any,
        currencyInfo.token
      );
    } else {
      this._contract = null;
    }

    const { chainIds, networkIds } = Config[chain];
    if (!chainIds.includes(BinanceChain.chainId)) {
      let networkId: string;
      if (chain === "BNB") {
        networkId = networkIds[__isDEV__ ? 1 : 0];
      } else {
        networkId = networkIds[0];
      }
      try {
        await BinanceChain.switchNetwork(networkId);
      } catch (error: any) {
        console.log("BinanceChain.switchNetwork catch error.", error);
        if (error.error === "user rejected") {
          return WalletError.USER_REJECTED_LOGIN;
        } else {
          return WalletError.FAIL;
        }
      }
    }
    this._enabledChain = chain;
    this._enabledCurrency = currency;
    try {
      const addresses: string[] = await BinanceChain.requestAddresses();
      const address = addresses.find((item) => /^0x/.test(item));
      if (address) {
        this._address = address;
        return WalletError.SUCCESS;
      } else {
        return WalletError.USER_NOT_LOGGED;
      }
    } catch (error: any) {
      console.log("BinanceChain.requestAddresses catch error.", error);
      if (error.error === "user rejected") {
        return WalletError.USER_REJECTED_LOGIN;
      } else {
        return WalletError.FAIL;
      }
    }
  }
  async getBalance(): Promise<{ status: WalletError; balance?: number }> {
    const BinanceChain: any = (window as any).BinanceChain;
    if (!this._address) {
      return { status: WalletError.USER_NOT_LOGGED };
    }
    let balance = 0;
    try {
      if (this._contract) {
        balance = await getContractBalance(this._contract, this._address);
      } else {
        const rawBalance = await BinanceChain.request({
          method: "eth_getBalance",
          params: [this._address],
        });
        balance = Number(unit.fromWei(rawBalance, "ether"));
      }
    } catch (error) {
      console.log("BinanceChain.getBalance catch error.", error);
    }
    return { status: WalletError.SUCCESS, balance };
  }
  async transaction(
    address: string,
    value: number,
    order: any,
    currencyInfo: any
  ): Promise<WalletError> {
    const BinanceChain: any = (window as any).BinanceChain;
    if (!this._address || !this._web3) {
      return WalletError.USER_NOT_LOGGED;
    }
    try {
      const isToken = Boolean(currencyInfo?.token);
      const transactionValue = isToken ? "0" : value;
      const { _web3 } = this;
      if (isToken) {
        const isApprove = await this.contractApprove(address, value);
        if (!isApprove) {
          return WalletError.FAIL;
        }
      }

      const data = await contractApiDataFn(_web3, {
        transferContract: this._contract,
        value,
        order,
        address,
        token: currencyInfo?.token,
      });
      const hash = await BinanceChain.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: this._address,
            to: address,
            value: `0x${unit.toWei(transactionValue, "ether").toString(16)}`,
            data,
          },
        ],
      });
      return WalletError.SUCCESS;
    } catch (error) {
      console.log(
        "BinanceChain.request method:eth_sendTransaction catch error.",
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
        // console.log(`test:>approve:>err`, err);
      });
  }
  async signature(message: string): Promise<string | null> {
    const BinanceChain: any = (window as any).BinanceChain;
    try {
      const { signature } = await BinanceChain.bnbSign(
        this._address,
        Web3Utils.utf8ToHex(message)
      );
      return signature;
    } catch (error) {
      return null;
    }
  }
}
export default BinanceChainWallet;
