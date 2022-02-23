import { toContractValue } from './utils';

const minABI = [
  {
    inputs: [
      {
        internalType: 'string[]',
        name: '_opID',
        type: 'string[]',
      },
      {
        internalType: 'uint256[]',
        name: '_btAM',
        type: 'uint256[]',
      },
      {
        internalType: 'enum IDataBase.FoldsType[]',
        name: '_ft',
        type: 'uint8[]',
      },
      {
        internalType: 'uint256[]',
        name: '_ftAM',
        type: 'uint256[]',
      },
    ],
    name: 'combinedBetSlip',
    outputs: [
      {
        internalType: 'bool',
        name: 'result',
        type: 'bool',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_token',
        type: 'address',
      },
      {
        internalType: 'string[]',
        name: '_opID',
        type: 'string[]',
      },
      {
        internalType: 'uint256[]',
        name: '_btAM',
        type: 'uint256[]',
      },
      {
        internalType: 'enum IDataBase.FoldsType[]',
        name: '_ft',
        type: 'uint8[]',
      },
      {
        internalType: 'uint256[]',
        name: '_ftAM',
        type: 'uint256[]',
      },
    ],
    name: 'combinedBetSlip_ERC20',
    outputs: [
      {
        internalType: 'bool',
        name: 'result',
        type: 'bool',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

export async function contractApiDataFn(web3: any, params: any) {
  const { address, order, value, token, transferContract } = params;
  const contract = new web3.eth.Contract(minABI, address);
  const { optionId } = order;

  const opts = [optionId + ''];
  if (token) {
    const amount = await toContractValue(transferContract, value);
    const singleAmount = [amount];
    const clusterType: number[] = [];
    const clusterAmount: number[] = [];
    return contract.methods.combinedBetSlip_ERC20(token, opts, singleAmount, clusterType, clusterAmount).encodeABI();
  } else {
    const singleAmount = [web3.utils.toWei(value + '')];
    const clusterType: number[] = [];
    const clusterAmount: number[] = [];
    return contract.methods.combinedBetSlip(opts, singleAmount, clusterType, clusterAmount).encodeABI();
  }
}

export function genAllowance(amount: number) {
  const intLen = (amount + '').split('.')[0].length;
  const wei = 15 - intLen;
  return amount * Math.pow(10, wei);
}
