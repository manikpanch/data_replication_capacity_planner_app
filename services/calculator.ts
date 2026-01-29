import { MasterDataObject, TargetSystem, GlobalConfig, Mapping, SimulationResult, QueueResult, MiddlewareCluster, ClusterHealth } from '../types';

export const calculateSimulation = (
  mdos: MasterDataObject[],
  targets: TargetSystem[],
  mappings: Mapping[],
  config: GlobalConfig,
  clusters: MiddlewareCluster[]
): SimulationResult => {
  
  const queues: QueueResult[] = [];
  let totalApiRequests = 0;
  let maxPacketPayloadKB = 0;
  let aggregatePeakInboundRPS = 0;

  // Track Cluster Usage
  const clusterUsage = new Map<string, {
    activeQueues: number,
    usedThreads: number,
    totalStorageMB: number
  }>();

  // Initialize cluster usage tracking
  clusters.forEach(c => {
    clusterUsage.set(c.id, { activeQueues: 0, usedThreads: 0, totalStorageMB: 0 });
  });

  // 1. Process each MDO
  mdos.forEach(mdo => {
    const currentPayloadKB = mdo.packetSize * mdo.payloadSizePerRecordKB;
    if (currentPayloadKB > maxPacketPayloadKB) {
      maxPacketPayloadKB = currentPayloadKB;
    }

    const mdoPackets = Math.ceil(mdo.volume / mdo.packetSize);
    let activeTargetCount = 0;

    targets.forEach(target => {
      const isMapped = mappings.find(m => m.mdoId === mdo.id && m.targetId === target.id)?.active;
      
      if (isMapped) {
        activeTargetCount++;
        const cluster = clusters.find(c => c.id === target.middlewareClusterId);

        let inboundRateRecordsPerSec = 0;
        let effectiveInboundRPS = 0;
        let theoreticalInboundRPS = 0;
        let middlewareLimitRPS = 0;
        let isThrottled = false;
        
        let outflowRateRecordsPerSec = 0;
        let completionTimeSeconds = 0;
        let maxQueueDepthRecords = 0;
        let maxQueueStorageMB = 0;
        
        // Sync Specifics
        let usedThreads = 0;
        let isThreadBound = false;
        
        // Packet Splitting Logic
        // Determine the actual packet size sent to Target
        const effTargetPacketSize = Math.min(mdo.packetSize, target.targetPacketSize || mdo.packetSize);
        // How many target calls does 1 MDG call turn into?
        const splitFactor = Math.ceil(mdo.packetSize / effTargetPacketSize);

        if (config.integrationPattern === 'ASYNC') {
            // --- ASYNC (QUEUED) LOGIC ---
            
            // 1. Inbound (MDG -> Queue)
            theoreticalInboundRPS = (1000 / config.avgMiddlewareResponseTimeMs) * config.mdgConcurrency;
            
            effectiveInboundRPS = theoreticalInboundRPS;
            
            if (target.middlewareRateLimitEnabled && target.middlewareIngressRPM) {
                middlewareLimitRPS = target.middlewareIngressRPM / 60;
                if (theoreticalInboundRPS > middlewareLimitRPS) {
                    effectiveInboundRPS = middlewareLimitRPS;
                    isThrottled = true;
                }
            }
            
            inboundRateRecordsPerSec = effectiveInboundRPS * mdo.packetSize;

            // 2. Outbound (Queue -> Target)
            // Outflow is limited by Target RPM * Target Packet Size
            const maxTargetRecordsPerMin = target.apiRateLimitRPM * effTargetPacketSize;
            outflowRateRecordsPerSec = maxTargetRecordsPerMin / 60;
            
            const safeOutflowRate = outflowRateRecordsPerSec > 0 ? outflowRateRecordsPerSec : 0.001;
            completionTimeSeconds = mdo.volume / safeOutflowRate;

            // 3. Queue Calculation
            const timeToIngest = mdo.volume / inboundRateRecordsPerSec;
            if (inboundRateRecordsPerSec > safeOutflowRate) {
                const growthRate = inboundRateRecordsPerSec - safeOutflowRate;
                maxQueueDepthRecords = growthRate * timeToIngest;
            } else {
                maxQueueDepthRecords = mdo.packetSize;
            }
            maxQueueDepthRecords = Math.min(maxQueueDepthRecords, mdo.volume);
            maxQueueStorageMB = (maxQueueDepthRecords * mdo.payloadSizePerRecordKB) / 1024;
            
            usedThreads = config.mdgConcurrency; 

            // 4. Cluster Usage Update (Async)
            if (cluster) {
                const usage = clusterUsage.get(cluster.id);
                if (usage) {
                    usage.activeQueues += 1;
                    usage.usedThreads += config.mdgConcurrency; 
                    usage.totalStorageMB += maxQueueStorageMB;
                }
            }

        } else {
            // --- SYNC (REQUEST-RESPONSE) LOGIC ---
            
            // 1. Calculate Round Trip Time (RTT) per MDG Request
            // In Sync mode, Middleware iterates over the split packets.
            // Total Target Processing Time = (Split Factor) * (Time per Target Call)
            const targetLatencySec = target.apiRateLimitRPM > 0 ? (60 / target.apiRateLimitRPM) : 0.1;
            const totalTargetProcessingTime = splitFactor * targetLatencySec;
            
            const middlewareOverheadSec = config.avgMiddlewareResponseTimeMs / 1000;
            const totalRTTSeconds = middlewareOverheadSec + totalTargetProcessingTime;
            
            // 2. Max RPS Possible by Thread Pool
            const maxMdgRpsByThreads = config.mdgConcurrency / totalRTTSeconds;
            
            // 3. Max RPS Allowed by Target
            // Target allows X calls/min. Since 1 MDG call = N target calls,
            // MDG is allowed (X / N) calls/min.
            const maxMdgRpsByTarget = (target.apiRateLimitRPM / 60) / splitFactor;

            // 4. Bottleneck Analysis
            theoreticalInboundRPS = Math.min(maxMdgRpsByThreads, maxMdgRpsByTarget);
            effectiveInboundRPS = theoreticalInboundRPS;
            isThreadBound = maxMdgRpsByThreads < maxMdgRpsByTarget;

            // 5. Thread Usage
            // In Sync mode, if MDG opens a connection, the Middleware holds a thread
            // regardless of whether it's processing or waiting on the Target.
            // Therefore, Used Threads = Allocated Concurrency from MDG.
            usedThreads = config.mdgConcurrency;
            
            if (target.middlewareRateLimitEnabled && target.middlewareIngressRPM) {
                middlewareLimitRPS = target.middlewareIngressRPM / 60;
                 if (theoreticalInboundRPS > middlewareLimitRPS) {
                    effectiveInboundRPS = middlewareLimitRPS;
                    isThrottled = true;
                }
            }

            inboundRateRecordsPerSec = effectiveInboundRPS * mdo.packetSize;
            outflowRateRecordsPerSec = inboundRateRecordsPerSec; 
            
            const safeRate = inboundRateRecordsPerSec > 0 ? inboundRateRecordsPerSec : 0.001;
            completionTimeSeconds = mdo.volume / safeRate;

            maxQueueDepthRecords = 0;
            maxQueueStorageMB = 0;

            // 6. Cluster Usage Update (Sync)
            if (cluster) {
                const usage = clusterUsage.get(cluster.id);
                if (usage) {
                    usage.usedThreads += usedThreads;
                    usage.activeQueues += 0; 
                    usage.totalStorageMB += 0;
                }
            }
        }

        aggregatePeakInboundRPS += effectiveInboundRPS;
        const maxQueueDepthPackets = Math.ceil(maxQueueDepthRecords / mdo.packetSize);
        const totalDataMB = (mdo.volume * mdo.payloadSizePerRecordKB) / 1024;

        queues.push({
          targetName: target.name,
          targetId: target.id,
          middlewareClusterId: target.middlewareClusterId,
          mdoName: mdo.name,
          totalRecords: mdo.volume,
          totalPackets: mdoPackets,
          payloadPerPacketKB: currentPayloadKB,
          totalDataMB,
          
          splitFactor,
          effectiveTargetPacketSize: effTargetPacketSize,

          inboundThroughputRecordsPerSec: inboundRateRecordsPerSec,
          theoreticalInboundRPS,
          middlewareLimitRPS,
          isThrottled,
          usedThreads,
          isThreadBound,
          outboundProcessingRateRecordsPerSec: outflowRateRecordsPerSec,
          completionTimeSeconds,
          maxQueueDepthPackets,
          maxQueueStorageMB,
          isStorageOverflow: false 
        });
      }
    });

    totalApiRequests += (mdoPackets * activeTargetCount);
  });

  // Calculate Peak Network Throughput (MB/s)
  const requiredNetworkThroughputMBPS = (aggregatePeakInboundRPS * maxPacketPayloadKB) / 1024;
  const totalStorageRequiredMB = queues.reduce((sum, q) => sum + q.maxQueueStorageMB, 0);
  const overallCompletionTimeSeconds = queues.reduce((max, q) => Math.max(max, q.completionTimeSeconds), 0);

  // Generate Cluster Health Report
  const clusterHealth: ClusterHealth[] = clusters.map(c => {
     const usage = clusterUsage.get(c.id) || { activeQueues: 0, usedThreads: 0, totalStorageMB: 0 };
     
     return {
       clusterId: c.id,
       clusterName: c.name,
       activeQueues: usage.activeQueues,
       maxQueues: c.maxQueues,
       usedThreads: Math.ceil(usage.usedThreads), 
       maxThreads: c.maxThreads,
       totalStorageUsedMB: usage.totalStorageMB,
       maxStorageMB: c.maxQueueCapacityMB,
       isQueueCountBreached: usage.activeQueues > c.maxQueues,
       isThreadCountBreached: usage.usedThreads > c.maxThreads,
       hasStorageWarning: usage.totalStorageMB > c.maxQueueCapacityMB
     };
  });

  return {
    queues,
    clusterHealth,
    totalApiRequests,
    maxApiLoadRPS: aggregatePeakInboundRPS,
    requiredNetworkThroughputMBPS,
    totalStorageRequiredMB,
    overallCompletionTimeSeconds
  };
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hrs`;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(num);
};