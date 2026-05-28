import { BadGatewayException, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class HermesProxyService {
  async forward(req: Request, res: Response, target: { endpoint: string; instanceId: string }, options: {
    tenantId?: string;
    userId?: string;
    targetPath: string;
    publicGateway?: boolean;
  }) {
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${target.endpoint}${options.targetPath}`, {
        method: req.method,
        headers: this.buildProxyHeaders(req, target.instanceId, options),
        body: this.getProxyBody(req),
        redirect: 'manual',
      });
    } catch (error) {
      throw new BadGatewayException(error instanceof Error ? error.message : 'Hermes proxy request failed');
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!['connection', 'content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }

  targetPathFromMarker(req: Request, marker: string) {
    const originalUrl = req.originalUrl || req.url;
    const markerIndex = originalUrl.indexOf(marker);
    const targetPath = markerIndex >= 0 ? originalUrl.slice(markerIndex + marker.length) : '';
    return targetPath || '/';
  }

  private buildProxyHeaders(req: Request, instanceId: string, options: {
    tenantId?: string;
    userId?: string;
    publicGateway?: boolean;
  }) {
    const headers = new Headers();
    for (const key of ['accept', 'content-type', 'user-agent']) {
      const value = req.headers[key];
      if (typeof value === 'string') {
        headers.set(key, value);
      }
    }
    headers.set('x-agenthub-instance-id', instanceId);
    headers.set('x-agenthub-proxy-mode', options.publicGateway ? 'public-gateway' : 'authenticated');
    if (options.tenantId) {
      headers.set('x-agenthub-tenant-id', options.tenantId);
    }
    if (options.userId) {
      headers.set('x-agenthub-user-id', options.userId);
    }
    return headers;
  }

  private getProxyBody(req: Request) {
    if (['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      return undefined;
    }
    if (req.body === undefined || req.body === null) {
      return undefined;
    }
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
}
