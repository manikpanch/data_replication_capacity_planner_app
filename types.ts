export interface MasterDataObject {
  id: string;
  name: string;
  volume: number; // Total number of records
  packetSize: number; // Records per request
  payloadSizePerRecordKB: number; // KB per record
}

export interface MiddlewareCluster {
  id: string;
  name: string;
  maxThreads: number; // Max concurrent processing threads available in this runtime
  maxQueues: number; // Max number of queues allowed in this cluster
  maxQueueCapacityMB: number; // TOTAL Storage capacity for the ENTIRE cluster
}

export interface TargetSystem {
  id: string;
  middlewareClusterId: string; // Link to MiddlewareCluster
  name: string;
  apiRateLimitRPM: number; // Max Requests Per Minute accepted by Target
  targetPacketSize?: number; // Max records per single API call to Target
  replicationType: 'Realtime' | 'Scheduled';
  scheduleIntervalMinutes?: number;
  
  // Middleware Interface Constraints
  middlewareRateLimitEnabled?: boolean; // Toggle for Middleware Ingress Limiting
  middlewareIngressRPM?: number; // Max Requests Per Minute accepted by Middleware for this interface
}

export interface GlobalConfig {
  avgMiddlewareResponseTimeMs: number; // Time for MDG -> Middleware acknowledgment
  mdgConcurrency: number; // Number of parallel threads MDG uses PER TARGET INTERFACE
  integrationPattern: 'ASYNC' | 'SYNC'; // 'ASYNC' = Queued (Fire & Forget), 'SYNC' = Request/Response (Wait for Target)
}

export interface Mapping {
  mdoId: string;
  targetId: string;
  active: boolean;
}

export interface QueueResult {
  targetName: string;
  targetId: string;
  middlewareClusterId: string;
  mdoName: string;
  totalRecords: number;
  totalPackets: number;
  payloadPerPacketKB: number;
  totalDataMB: number;
  
  // Splitting Info
  splitFactor: number; // How many target calls per 1 MDG call
  effectiveTargetPacketSize: number;

  inboundThroughputRecordsPerSec: number;
  theoreticalInboundRPS: number; // Max RPS MDG could push without Middleware Rate Limit
  middlewareLimitRPS: number; // The configured limit (0 if disabled)
  isThrottled: boolean; // True if Theoretical > Limit
  
  // Sync Mode Specifics
  usedThreads: number; // Average number of open connections (active threads) during processing
  isThreadBound: boolean; // True if thread count is the primary bottleneck
  
  outboundProcessingRateRecordsPerSec: number;
  
  completionTimeSeconds: number;
  maxQueueDepthPackets: number;
  maxQueueStorageMB: number;
  isStorageOverflow: boolean; // Deprecated for individual queue, handled at cluster level
}

export interface ClusterHealth {
  clusterId: string;
  clusterName: string;
  activeQueues: number;
  maxQueues: number;
  usedThreads: number; // Estimated threads based on MDG Concurrency * Active Targets
  maxThreads: number;
  totalStorageUsedMB: number;
  maxStorageMB: number;
  isQueueCountBreached: boolean;
  isThreadCountBreached: boolean;
  hasStorageWarning: boolean; // If Total Cluster Storage > Max Capacity
}

export interface SimulationResult {
  queues: QueueResult[];
  clusterHealth: ClusterHealth[];
  totalApiRequests: number;
  maxApiLoadRPS: number; // Peak Inbound Requests Per Second (Aggregate)
  requiredNetworkThroughputMBPS: number; // Peak Inbound Data Rate
  totalStorageRequiredMB: number;
  overallCompletionTimeSeconds: number;
}