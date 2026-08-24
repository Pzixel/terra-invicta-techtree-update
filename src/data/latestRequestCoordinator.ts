export interface LatestRequest<TContext> {
  readonly sequence: number;
  readonly controller: AbortController;
  readonly context: TContext;
}

export class LatestRequestCoordinator<TContext> {
  private sequence = 0;
  private active: LatestRequest<TContext> | null = null;

  begin(context: TContext): LatestRequest<TContext> {
    this.active?.controller.abort();
    const request = {
      sequence: ++this.sequence,
      controller: new AbortController(),
      context,
    };
    this.active = request;
    return request;
  }

  accept(request: LatestRequest<TContext>): boolean {
    if (!this.isCurrent(request)) return false;
    this.active = null;
    return true;
  }

  reject(request: LatestRequest<TContext>): TContext | null {
    if (!this.isCurrent(request)) return null;
    this.active = null;
    return request.context;
  }

  cancel(request: LatestRequest<TContext>): void {
    request.controller.abort();
    if (this.active === request) this.active = null;
  }

  private isCurrent(request: LatestRequest<TContext>): boolean {
    return this.active === request &&
      request.sequence === this.sequence &&
      !request.controller.signal.aborted;
  }
}
