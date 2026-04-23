export interface IDataPlaneClient {
  createInstance(req: { tenantId: string; tier: string }): Promise<{ containerId: string; endpoint: string }>;
  getInstanceStatus(req: { containerId: string }): Promise<{ status: string; endpoint: string }>;
}

export const DATA_PLANE_CLIENT = Symbol('DATA_PLANE_CLIENT');
