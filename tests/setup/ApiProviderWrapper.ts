import { ApiPromise, WsProvider } from '@polkadot/api';

export class ApiProviderWrapper {
  private api: ApiPromise | null;
  private wsProvider: WsProvider | null;
  private webSocketEndpoint: string;

  constructor(webSocketEndpoint: string) {
    this.api = null;
    this.wsProvider = null;
    this.webSocketEndpoint = webSocketEndpoint;
  }

  getNotConnected = async () => {
    await this.closeApi();
    this.wsProvider = new WsProvider(this.webSocketEndpoint);
    this.api = new ApiPromise({ provider: this.wsProvider });

    return this.api;
  };
  getAndWaitForReady = async () => {
    if (!this.wsProvider) this.wsProvider = new WsProvider(this.webSocketEndpoint);
    if (!this.api) {
      this.api = await ApiPromise.create({ provider: this.wsProvider });
    }
    await this.api.isReady;
    return this.api;
  };

  closeApi = async () => {
    await this.api?.disconnect();
    await this.wsProvider?.disconnect();
    this.wsProvider = null;
    this.api = null;
  };
}
