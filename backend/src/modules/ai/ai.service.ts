export class AIService {
  analyze(context:any){
    return {
      signal:"WAIT",
      confidence:0,
      context
    };
  }
}
