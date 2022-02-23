import unit from 'ethjs-unit';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import Web3Utils from 'web3-utils';

import detectEthereumProvider from '@metamask/detect-provider';

import { WalletError } from '.';
import { contractApiDataFn, genAllowance } from './contractApiDataFn';
import { defaultAbi } from './testData';
import { getContractBalance } from './utils';

const ethBrowser = {
  '0x1': 'https://etherscan.io',
  '0x3': 'https://ropsten.etherscan.io',
  '0x2a': 'https://kovan.etherscan.io',
  '0x4': 'https://rinkeby.etherscan.io',
  '0x5': 'https://goerli.etherscan.io/',
};

const BNBConfig = {
  '0x61': {
    chainId: '0x61',
    chainName: 'Binance Smart Chain - Testnet',
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  '0x38': {
    chainId: '0x38',
    chainName: 'Binance Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
};

class MetaMask {
  name = 'MetaMask';
  icon = require('@/assets/wallet-icons/meta-mask.svg');
  provider = 'https://metamask.io/';
  supportChain = ['ETH', 'BNB'];
  supportCurrencies = ['ETH', 'BNB'];
  private _isEnabled = false;
  private _address = '';
  private _enabledChain: string | null = null;
  private _enabledCurrency: string | null = null;
  private ethereum: any | null = null;
  private _web3: Web3 | null = null;
  private _contract: Contract | null = null;
  private removeAllListenFn: null | (() => void) = null;
  constructor() {
    (window as any).MetaMaskWallet = this;
    (window as any).Web3Utils = Web3Utils;
  }

  get web3() {
    return this._web3;
  }

  get browser(): { name: string; url: string } {
    if (!this._enabledCurrency || !this._address) return { name: '', url: '' };
    let name: string, browser: string;
    if (this._enabledCurrency === 'BNB') {
      name = 'BscScan';
      const { blockExplorerUrls } = BNBConfig[this.ethereum.chainId];
      browser = blockExplorerUrls[0];
    } else {
      name = 'Etherscan';
      browser = ethBrowser[this.ethereum.chainId] || '';
    }
    return { name, url: `${browser}/address/${this._address}` };
  }

  get address() {
    return this._address;
  }

  logout() {
    this.removeAllListenFn?.();
    this.removeAllListenFn = null;
    this.ethereum = null;
    this._enabledChain = null;
    this._enabledCurrency = null;
    this._isEnabled = false;
    this._address = '';
    this._contract = null;
    this._web3 = null;
  }

  onEnable() {
    const ethereum = this.ethereum;
    if (!ethereum) {
      return;
    }
    const accountsChangedListenFn = (accounts: any) => {
      if (!accounts?.length) {
        localStorage.removeItem('BITGAME_CONTRACT_WALLET');
      }
      window.location.reload();
    };
    const chainChangedListenFn = (chainId: string) => {
      let chain = 'ETH';
      if (Object.keys(BNBConfig).includes(ethereum.chainId)) {
        chain = 'BNB';
      }

      if (chain !== this._enabledChain) {
        const currency = chain; // 主动切换链的时候就自动切到chain对应的currency上 -> chain-ETH -> currency-ETH...
        window.localStorage.setItem('BITGAME_CONTRACT_CURRENCY', currency);
        window.location.reload();
      }
    };

    ethereum?.on('accountsChanged', accountsChangedListenFn);
    ethereum?.on('chainChanged', chainChangedListenFn);

    this.removeAllListenFn = () => {
      ethereum.removeListener('accountsChanged', accountsChangedListenFn);
      ethereum.removeListener('chainChanged', chainChangedListenFn);
    };
  }
  async changeCurrency(currencyInfo?: any): Promise<WalletError> {
    const { currency, chain } = currencyInfo;
    console.log(`test:>changeCurrency:>1`);
    if (currency === this._enabledCurrency) {
      return WalletError.SUCCESS;
    }
    this.removeAllListenFn?.();
    this.removeAllListenFn = null;

    const ethereum = this.ethereum;

    if (!ethereum || !this._web3) {
      return WalletError.FAIL;
    }

    console.log(`test:>changeCurrency:>2`);
    if (currencyInfo?.token) {
      this._contract = new this._web3.eth.Contract(defaultAbi as any, currencyInfo.token);
    } else {
      this._contract = null;
    }

    console.log(`test:>changeCurrency:>3`);
    if (chain === 'BNB') {
      if (!Object.keys(BNBConfig).includes(ethereum.chainId)) {
        const targetChainId = __isDEV__ ? '0x61' : '0x38';
        const config = BNBConfig[targetChainId];
        try {
          await ethereum.request({ method: 'wallet_addEthereumChain', params: [config] });

          console.log(`test:>changeCurrency:>4`);
          // 即使用户不同意切换链也返回成功，所以这里通过判断链是否切换过来来判断用户是否同意
          const isChange = await awaitDetectFn(
            () => {
              return ethereum.chainId === targetChainId;
            },
            300,
            5000,
          );

          console.log(`test:>changeCurrency:>5`, isChange);
          if (!isChange) {
            throw WalletError.USER_REJECTED_LOGIN;
          }
        } catch (error: any) {
          console.log(`test:>changeCurrency:>6`, error);
          if (error.code === 4001 || error === WalletError.USER_REJECTED_LOGIN) {
            return WalletError.USER_REJECTED_LOGIN;
          }
          return WalletError.USER_NOT_LOGGED;
        }
      }
    } else {
      if (!Object.keys(ethBrowser).includes(ethereum.chainId)) {
        try {
          const targetChainId = __isDEV__ ? '0x3' : '0x1';
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: __isDEV__ ? '0x3' : '0x1' }],
          });
          // 即使用户不同意切换链也返回成功，所以这里通过判断链是否切换过来来判断用户是否同意
          const isChange = await awaitDetectFn(
            () => {
              return ethereum.chainId === targetChainId;
            },
            300,
            5000,
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
      }
    }
    console.log(`test:>changeCurrency:>7`);
    this._enabledChain = chain;
    this._enabledCurrency = currency;
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
    if (this._isEnabled && this._address && this._enabledCurrency === currency) {
      return WalletError.SUCCESS;
    }

    const ethereum: any = await findMetaMaskProvider();

    if (!ethereum) {
      return WalletError.NOT_FOUND;
    }

    this.ethereum = ethereum;
    this._isEnabled = true;
    this._web3 = new Web3(ethereum);
    if (currencyInfo?.token) {
      this._contract = new this._web3.eth.Contract(defaultAbi as any, currencyInfo.token);
    } else {
      this._contract = null;
    }
    if (chain === 'BNB') {
      if (!Object.keys(BNBConfig).includes(ethereum.chainId)) {
        const targetChainId = __isDEV__ ? '0x61' : '0x38';
        const config = BNBConfig[targetChainId];
        try {
          await ethereum.request({ method: 'wallet_addEthereumChain', params: [config] });

          // 即使用户不同意切换链也返回成功，所以这里通过判断链是否切换过来来判断用户是否同意
          const isChange = await awaitDetectFn(
            () => {
              return ethereum.chainId === targetChainId;
            },
            300,
            5000,
          );
          if (!isChange) {
            throw WalletError.USER_REJECTED_LOGIN;
          }
        } catch (error: any) {
          if (error.code === 4001 || error === WalletError.USER_REJECTED_LOGIN) {
            return WalletError.USER_REJECTED_LOGIN;
          }
          return WalletError.USER_NOT_LOGGED;
        }
      }
    } else {
      if (!Object.keys(ethBrowser).includes(ethereum.chainId)) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: __isDEV__ ? '0x3' : '0x1' }],
          });
        } catch (error: any) {
          if (error.code === 4001) {
            return WalletError.USER_REJECTED_LOGIN;
          }
          return WalletError.USER_NOT_LOGGED;
        }
      }
    }
    this._enabledChain = chain;
    this._enabledCurrency = currency;

    try {
      const [address] = await ethereum.request({ method: 'eth_requestAccounts' });
      if (address) {
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
        const rawBalance = await this.ethereum.request({ method: 'eth_getBalance', params: [this._address, 'latest'] });
        balance = Number(unit.fromWei(rawBalance, 'ether'));
      }
    } catch (error) {
      console.log('Metamask.getBalance catch error.', error);
    }
    return { status: WalletError.SUCCESS, balance };
  }
  async transaction(address: string, value: number, order: any, currencyInfo?: any): Promise<WalletError> {
    if (!this._address || !this._web3) {
      return WalletError.USER_NOT_LOGGED;
    }
    try {
      const isToken = Boolean(currencyInfo?.token);
      const transactionValue = isToken ? '0' : value;
      const { _web3 } = this;
      if (isToken) {
        const isApprove = await this.contractApprove(address, value);
        if (!isApprove) {
          return WalletError.FAIL;
        }
      }
      console.log(`test:>1`);
      const data = await contractApiDataFn(_web3, {
        value,
        order,
        address,
        token: currencyInfo?.token,
        transferContract: this._contract,
      });
      console.log(`test:>2`, data);
      const hash = await this.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: this._address,
            to: address,
            value: `0x${unit.toWei(transactionValue, 'ether').toString(16)}`,
            data,
          },
        ],
      });
      console.log(`test:>3`, data);
      return WalletError.SUCCESS;
    } catch (error) {
      console.log(`test:>4`, error);
      console.log('ethereum.request method:eth_sendTransaction catch error.', error);
      return WalletError.FAIL;
    }
  }
  async contractApprove(toAddress: string, amount: number) {
    const { _contract, _web3, _address } = this;
    if (!_contract || !_web3) {
      return false;
    }
    const allow = await _contract.methods.allowance(_address, toAddress).call();

    const _amount = _web3.utils.toWei(amount + '');
    // console.log(`test:>approve:>allow=${allow}|amount=${amount}`);
    if (_amount <= allow) {
      return true;
    }
    const allowAmount = genAllowance(amount);
    // console.log(`test:>approve:>_amount <= allow`, allowAmount);
    return await _contract.methods
      .approve(toAddress, _web3.utils.toWei(allowAmount + ''))
      .send({ from: _address })
      .then((data: any) => {
        return true;
      })
      .catch((err: any) => {
        return false;
      });
  }
  async signature(message: string): Promise<string | null> {
    try {
      const signature = await this.ethereum.request({
        method: 'personal_sign',
        params: [Web3Utils.utf8ToHex(message), this._address],
      });
      return signature;
    } catch (error) {
      return null;
    }
  }
}
export default MetaMask;

async function findMetaMaskProvider() {
  if (!(window as any).ethereum) {
    return;
  }
  const { providers } = (window as any).ethereum;
  let selectedProvider: any;
  for (const provider of providers || []) {
    if (provider.isMetaMask) {
      selectedProvider = provider;
    }
  }
  if (selectedProvider) {
    // (window as any).ethereum.setSelectedProvider(selectedProvider);
    return selectedProvider;
  } else {
    return await detectEthereumProvider();
  }
}

export function awaitDetectFn(detectFun: () => boolean, stepTime: number, maxTime: number) {
  return new Promise((resolve, reject) => {
    let time = 0;
    const interval = setInterval(fn, stepTime);

    function fn() {
      time += stepTime;
      if (time > maxTime) {
        clearInterval(interval);
        return resolve(false);
      }
      if (detectFun()) {
        clearInterval(interval);
        return resolve(true);
      }
    }
  });
}
