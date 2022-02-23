import BinanceChainWallet from "./BinanceChain";
import CoinBase from "./CoinBase";
import MetaMask from "./MetaMask";
import Tronlink from "./Tronlink";
import WalletConnect from "./WalletConnect";

export enum WalletError {
  SUCCESS = "success",
  FAIL = "fail",
  NOT_FOUND = "wallet_not_found",
  USER_REJECTED_LOGIN = "user_rejected_login",
  ADDRESS_ERROR = "user_address_error",
  USER_NOT_LOGGED = "user_not_logged",
  CHAIN_ERROR = "wallet_chain_error",
  WALLET_CONNECT_CHAIN_ERROR = "wallet_connect_chain_error",
}
export type ChainType = "ETH" | "TRX" | "BNB";
export const ContractChains: ChainType[] = ["ETH", "TRX", "BNB"];

const Wallets = [
  new Tronlink(),
  new MetaMask(),
  new WalletConnect(),
  new CoinBase(),
  new BinanceChainWallet(),
];

export default Wallets;
