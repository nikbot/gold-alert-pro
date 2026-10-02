export class MarketService {
  getMarket(symbol:string){
    return {
      symbol,
      value:0,
      source:"provider",
      timestamp:new Date(),
      status:"OFFLINE"
    };
  }
}
