import Big from "big.js";

export async function getContractBalance(contract: any, address: string) {
  const decimals = await contract.methods.decimals().call();
  const balance = await contract.methods.balanceOf(address).call();
  return Big(balance).div(Math.pow(10, decimals)).toNumber();
}
export async function toContractValue(contract: any, amount: number) {
  const decimals = await contract.methods.decimals().call();
  return Big(amount).mul(Math.pow(10, decimals)).valueOf();
}

/**
 * 获取url上参数
 * @param {string} name 可选，参数的name，如果不传，返回所有queryParams
 */
export const getQueryParams = (name?: string, search?: string) => {
  const query = (search || window.location.search).substring(1);
  const vars = query.split("&");
  const quertString: any = {};
  // tslint:disable-next-line: prefer-for-of
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split("=");
    const key = decodeURIComponent(pair[0] || "");
    const value = decodeURIComponent(pair[1] || "");
    // If first entry with this name
    if (typeof quertString[key] === "undefined") {
      quertString[key] = decodeURIComponent(value || "");
      // If second entry with this name
    } else if (typeof quertString[key] === "string") {
      const arr = [quertString[key], decodeURIComponent(value || "")];
      quertString[key] = arr;
      // If third or later entry with this name
    } else {
      quertString[key].push(decodeURIComponent(value || ""));
    }
  }
  return name ? quertString[name] : quertString;
};
