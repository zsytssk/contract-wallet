import { ChainType, WalletError } from '.';

const browser = 'https://tronscan.org/#/address/{address}';
const browser_name = 'Tron Link';

const tronWenListenFn = (e: any) => {
  if (e.data.message?.action == 'disconnect') {
    localStorage.removeItem('BITGAME_CONTRACT_WALLET');
    window.location.reload();
  }
};

class Tronlink {
  readonly name = 'Tronlink';
  readonly icon = require('@/assets/wallet-icons/tron-link.svg');
  readonly provider = 'https://www.tronlink.org/';
  readonly supportChain = ['TRX'];
  readonly supportCurrencies = ['TRX'];
  private _isEnabled = false;
  private _enabledCurrency: string | null = null;
  private _contract: any | null;
  constructor() {
    (window as any).TronlinkWallet = this;
  }

  get browser(): { name: string; url: string } {
    const tronWeb = (window as any).tronWeb;
    return { name: browser_name, url: browser.replace('{address}', tronWeb ? tronWeb.defaultAddress.base58 : '') };
  }

  get address(): string {
    const tronWeb = (window as any).tronWeb;
    return tronWeb ? tronWeb.defaultAddress.base58 : '';
  }

  logout() {
    window.removeEventListener('message', tronWenListenFn);
    this._isEnabled = false;
  }
  onEnable() {
    this._isEnabled = true;
    window.addEventListener('message', tronWenListenFn);
  }
  async changeCurrency(currencyInfo: any): Promise<WalletError> {
    if (!(window as any).tronWeb) {
      return WalletError.FAIL;
    }

    if (currencyInfo?.token) {
      const tronWeb = (window as any).tronWeb;
      this._contract = await tronWeb.contract().at(currencyInfo?.token);
    } else {
      this._contract = null;
    }

    return WalletError.SUCCESS;
  }
  async enable(currencyInfo: any) {
    console.log(`test:>0`, currencyInfo.currency, currencyInfo.chain, currencyInfo.token);
    const result = await this._enable(currencyInfo);
    console.log(`test:>1`, currencyInfo.currency, currencyInfo.chain, currencyInfo.token);
    if (result === WalletError.SUCCESS) {
      if (currencyInfo?.token) {
        console.log(`test:>2`, currencyInfo.currency, currencyInfo.chain, currencyInfo.token);
        const tronWeb = (window as any).tronWeb;
        this._contract = await tronWeb.contract().at(currencyInfo?.token);
        console.log(`test:>3`, currencyInfo.currency, currencyInfo.chain, currencyInfo.token);
      } else {
        this._contract = null;
      }
    } else {
      this.logout();
    }
    return result;
  }
  private async _enable(currencyInfo?: any): Promise<WalletError> {
    return new Promise((resolve, reject) => {
      let totalCheckCount = 0;
      const interval = setInterval(() => {
        totalCheckCount++;
        if ((window as any)?.tronWeb?.defaultAddress.base58) {
          clearInterval(interval);
          this.onEnable();
          return resolve(WalletError.SUCCESS);
        } else if (totalCheckCount >= 50) {
          clearInterval(interval);
          return resolve(WalletError.NOT_FOUND);
        }
      }, 10);
    });
  }
  async getBalance(): Promise<{ status: WalletError; balance?: number }> {
    const tronWeb = (window as any).tronWeb;
    let balance = 0;
    if (!tronWeb) {
      return { status: WalletError.NOT_FOUND };
    }
    if (!this.address) {
      return { status: WalletError.USER_NOT_LOGGED };
    }
    try {
      if (this._contract) {
        balance = await this._contract.balanceOf(this.address).call();
      } else {
        balance = await tronWeb.trx.getBalance();
      }
    } catch (error) {
      return { status: WalletError.USER_NOT_LOGGED };
    }
    balance = Number(tronWeb.fromSun(balance));
    return { status: WalletError.SUCCESS, balance };
  }
  async transaction(address: string, value: number, order: any, currencyInfo?: any): Promise<WalletError> {
    const tronWeb = (window as any).tronWeb;
    if (!tronWeb) {
      return WalletError.NOT_FOUND;
    }
    if (!this.address) {
      return WalletError.USER_NOT_LOGGED;
    }
    console.log(`test:>tronlik:>0`);
    try {
      const isToken = Boolean(currencyInfo?.token);
      if (isToken) {
        const isApprove = await this.contractApprove(address, value);
        if (!isApprove) {
          return WalletError.FAIL;
        }
      }
      console.log(`test:>tronlik:>1`, address);

      const tronWeb = (window as any).tronWeb;
      const contract = await tronWeb.contract().at(address);
      const { optionId } = order;

      const opts = [optionId + ''];
      const singleAmount = [Number(tronWeb.toSun(value))];
      const clusterType: number[] = [];
      const clusterAmount: number[] = [];

      console.log(`test:>tronlik:>2`, isToken);
      let result: any;
      if (isToken) {
        result = await contract['combinedBetSlip_ERC20'](
          currencyInfo?.token,
          opts,
          singleAmount,
          clusterType,
          clusterAmount,
        ).send({
          callValue: Number(tronWeb.toSun(0)), //本次调用往合约转账的 SUN。
          shouldPollResponse: false, //如果设置为 TRUE，则会等到在 Solidity 节点上确认事务之后再返回结果。
        });
      } else {
        result = await contract['combinedBetSlip'](opts, singleAmount, clusterType, clusterAmount).send({
          callValue: Number(tronWeb.toSun(value)), //本次调用往合约转账的 SUN。
          shouldPollResponse: false, //如果设置为 TRUE，则会等到在 Solidity 节点上确认事务之后再返回结果。
        });
      }

      console.log(`test:>tronlink`, result);
      if (result) {
        return WalletError.SUCCESS;
      }
    } catch (error) {
      console.log('test:>Tronlink sendTransaction error', error);
    }
    return WalletError.FAIL;
  }
  async contractApprove(toAddress: string, amount: number) {
    const { _contract } = this;
    if (!_contract) {
      return false;
    }
    const tronWeb = (window as any).tronWeb;
    const allow = await _contract.allowance(this.address, toAddress).call();

    const _amount = Number(tronWeb.toSun(amount));
    // console.log(`test:>approve:>allow=${allow}|amount=${amount}`);
    if (_amount <= allow) {
      return true;
    }
    const allowAmount = Number(tronWeb.toSun(amount));
    // console.log(`test:>approve:>_amount <= allow`, allowAmount);
    return await _contract.methods
      .approve(toAddress, tronWeb.toSun(allowAmount))
      .send({ from: this.address })
      .then((data: any) => {
        return true;
      })
      .catch((err: any) => {
        return false;
      });
  }
  async signature(message: string): Promise<string | null> {
    try {
      const tronWeb = (window as any).tronWeb;
      const signature = await tronWeb.trx.sign(tronWeb.toHex(message));

      return signature;
    } catch (error) {
      return null;
    }
  }
}
export default Tronlink;
