import unit from "ethjs-unit";
import WalletLink, { WalletLinkProvider } from "walletlink";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import Web3Utils from "web3-utils";

import { ChainType, WalletError } from ".";
import { awaitDetectFn } from "./MetaMask";
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

export default class CoinBase {
  name = "CoinBase";
  provider = "https://wallet.coinbase.com/";
  supportChain = ["ETH"];
  supportCurrencies = ["ETH"];
  private _isEnabled = false;
  private _address = "";
  private _enabledCurrency: ChainType | null = null;
  private ethereum: WalletLinkProvider | null = null;
  private _web3: Web3 | null = null;
  private _contract: Contract | null = null;
  constructor() {
    (window as any).CoinBaseWallet = this;
  }

  logout() {
    this.ethereum?.disconnect();
    this.ethereum = null;
    this._enabledCurrency = null;
    this._address = "";
  }

  get browser(): { name: string; url: string } {
    if (!this._enabledCurrency || !this._address || !this.ethereum)
      return { name: "", url: "" };
    const name = "Etherscan";
    const browser = ethBrowser[this.ethereum.chainId] || "";
    return { name, url: `${browser}/address/${this._address}` };
  }

  get address() {
    return this._address;
  }
  onEnable() {}
  async changeCurrency(currencyInfo?: any): Promise<WalletError> {
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
  private async _enable(currencyInfo?: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;
    if (this._isEnabled && this._address) {
      return WalletError.SUCCESS;
    }

    const ethereum: any = await findCoinbaseProvider();

    if (!ethereum) {
      return WalletError.NOT_FOUND;
    }

    try {
      const [address] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      if (address) {
        try {
          const targetChainId = __isDEV__ ? "0x3" : "0x1";
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainId }],
          });
          const isChange = await awaitDetectFn(
            () => {
              return ethereum.chainId === targetChainId;
            },
            300,
            5000
          );
          if (!isChange) {
            throw WalletError.USER_REJECTED_LOGIN;
          }
        } catch (error: any) {
          if (error.code === 4001) {
            return WalletError.USER_REJECTED_LOGIN;
          }
          return WalletError.USER_NOT_LOGGED;
        }

        this._enabledCurrency = currency;
        this.ethereum = ethereum;
        this._web3 = new Web3(ethereum);
        if (currencyInfo?.token) {
          this._contract = new this._web3.eth.Contract(
            defaultAbi as any,
            currencyInfo.token
          );
        } else {
          this._contract = null;
        }
        this._isEnabled = true;
        this._address = address;
        this.onEnable();

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
  async getBalance(): Promise<{ status: WalletError; balance?: number }> {
    if (!this._address) {
      return { status: WalletError.USER_NOT_LOGGED };
    }
    let balance = 0;
    try {
      if (this._contract) {
        balance = await getContractBalance(this._contract, this._address);
      } else {
        const rawBalance =
          (await this.ethereum?.request({
            method: "eth_getBalance",
            params: [this._address, "latest"],
          })) || 0;
        balance = Number(unit.fromWei(rawBalance, "ether"));
      }
    } catch (error) {
      console.log("Coinbase.getBalance catch error.", error);
    }
    return { status: WalletError.SUCCESS, balance };
  }
  async transaction(
    address: string,
    value: number,
    order: any,
    currencyInfo?: any
  ): Promise<WalletError> {
    if (!this._address) {
      return WalletError.USER_NOT_LOGGED;
    }
    try {
      const isToken = Boolean(currencyInfo?.token);
      const transactionValue = isToken ? "0" : value;
      const { _web3 } = this;
      console.log(`test:>coinbase:>1`);
      if (isToken) {
        const isApprove = await this.contractApprove(address, value);
        if (!isApprove) {
          return WalletError.FAIL;
        }
      }
      console.log(`test:>coinbase:>2`);

      const data = await contractApiDataFn(_web3, {
        transferContract: this._contract,
        value,
        order,
        address,
        token: currencyInfo?.token,
      });
      console.log(`test:>coinbase:>3`, data);
      const hash = await this.ethereum?.request({
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
      console.log(`test:>coinbase:>4`, data);
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
        // console.log(`test:>approve:>err`, err);
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

async function findCoinbaseProvider() {
  if ((window as any).ethereum) {
    const { providers } = (window as any).ethereum;
    let selectedProvider: any;
    for (const provider of providers || []) {
      if (provider.isWalletLink) {
        selectedProvider = provider;
      }
    }
    if (selectedProvider) {
      // (window as any).ethereum.setSelectedProvider(selectedProvider);
      return selectedProvider;
    }
  }
  const walletLink = new WalletLink({
    appName: "bitgame",
    darkMode: false,
  });
  return walletLink.makeWeb3Provider(
    "https://mainnet-infura.wallet.coinbase.com/v3/fdea71e51fa145c4a6d6c2e94670c04f",
    __isDEV__ ? 3 : 1
  );
}
