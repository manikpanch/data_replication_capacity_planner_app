import React, { useMemo } from 'react';
import { Database, Server, Layers, Workflow, ShieldAlert, Cpu, AlertTriangle, ServerCog, ArrowRight, Ban, Cable } from 'lucide-react';
import { MasterDataObject, TargetSystem, Mapping, GlobalConfig, MiddlewareCluster } from '../types';
import { calculateSimulation, formatNumber, formatDuration } from '../services/calculator';
import { Tooltip } from './Tooltip';

interface SimulatorDiagramProps {
  mdos: MasterDataObject[];
  targets: TargetSystem[];
  clusters: MiddlewareCluster[];
  mappings: Mapping[];
  config: GlobalConfig;
}

export const SimulatorDiagram: React.FC<SimulatorDiagramProps> = ({
  mdos, targets, clusters, mappings, config
}) => {
  const result = useMemo(() => 
    calculateSimulation(mdos, targets, mappings, config, clusters),
    [mdos, targets, mappings, config, clusters]
  );

  const isSync = config.integrationPattern === 'SYNC';

  // Filter Active targets
  const activeTargets = targets.filter(t => 
    mappings.some(m => m.targetId === t.id && m.active)
  );

  // Group active targets by Cluster
  const targetsByCluster = new Map<string, TargetSystem[]>();
  clusters.forEach(c => targetsByCluster.set(c.id, []));
  activeTargets.forEach(t => {
    const list = targetsByCluster.get(t.middlewareClusterId) || [];
    list.push(t);
    targetsByCluster.set(t.middlewareClusterId, list);
  });

  // Calculate Layout Dimensions
  const rowHeight = 200;
  const headerHeight = 60;
  const clusterGap = 40;
  let totalHeight = headerHeight;
  
  // Map target to Y position
  const targetYPositions = new Map<string, number>();
  
  // Calculate vertical positions
  Array.from(targetsByCluster.entries()).forEach(([clusterId, clusterTargets]) => {
     if (clusterTargets.length > 0) {
         clusterTargets.forEach((t) => {
             targetYPositions.set(t.id, totalHeight + 40); // 40 padding
             totalHeight += rowHeight;
         });
         totalHeight += clusterGap; // Gap between clusters
     }
  });

  const canvasWidth = 1200;
  const canvasHeight = Math.max(600, totalHeight);
  
  const colX = {
    source: 50,
    rfc: 220,
    middleware: 450,
    queue: 650, // This is skipped in SYNC mode usually, or we just draw through it
    iflow: 850,
    target: 1050
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">Replication Simulator</h2>
                <span className={`text-xs px-2 py-0.5 rounded border ${isSync ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    {isSync ? 'Synchronous Mode' : 'Asynchronous Mode'}
                </span>
            </div>
            <p className="text-sm text-gray-500">Visual representation of data flow, {isSync ? 'Open Connections (Threads)' : 'queuing'}, and bottlenecks.</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Normal</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Capacity Breach</div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <svg width={canvasWidth} height={canvasHeight} className="bg-gray-50">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
            </marker>
            <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4F46E5" />
            </marker>
             <marker id="arrowhead-error" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
            </marker>
          </defs>

          {/* --- Columns Backgrounds --- */}
          {/* Source Zone */}
          <rect x="20" y="20" width="300" height={canvasHeight - 40} rx="16" fill="white" stroke="#E5E7EB" strokeDasharray="4 4" />
          <text x="170" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-400 uppercase tracking-widest">SAP MDG (Source)</text>
          
          {/* Middleware Zone - Now Just a label area, clusters will have their own boxes */}
          <text x="655" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-400 uppercase tracking-widest">Middleware Clusters</text>

          {/* Target Zone */}
          <rect x="980" y="20" width="200" height={canvasHeight - 40} rx="16" fill="white" stroke="#E5E7EB" strokeDasharray="4 4" />
          <text x="1080" y="50" textAnchor="middle" className="text-sm font-bold fill-gray-400 uppercase tracking-widest">Target Landscape</text>


          {/* --- Main Source Node (MDG) --- */}
          <foreignObject x={colX.source} y={canvasHeight / 2 - 100} width="140" height="200">
            <div className="h-full w-full bg-indigo-600 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center text-white relative z-10">
              <Database className="w-10 h-10 mb-2 opacity-90" />
              <div className="font-bold text-center">SAP MDG</div>
              <div className="text-xs text-indigo-200 mt-2 text-center">
                Total Volume<br/>
                <span className="font-mono font-bold text-white">
                  {formatNumber(mdos.reduce((acc, m) => acc + m.volume, 0))}
                </span>
              </div>
            </div>
          </foreignObject>


          {/* --- Render Lanes per Cluster --- */}
          {Array.from(targetsByCluster.entries()).map(([clusterId, clusterTargets]) => {
              if (clusterTargets.length === 0) return null;
              
              const firstY = targetYPositions.get(clusterTargets[0].id) || 0;
              const lastY = targetYPositions.get(clusterTargets[clusterTargets.length - 1].id) || 0;
              const clusterHeight = (lastY - firstY) + rowHeight; // Height of this cluster block
              const clusterY = firstY - 40; // Start slightly above first row

              const cluster = clusters.find(c => c.id === clusterId);
              const health = result.clusterHealth.find(h => h.clusterId === clusterId);
              const isWarning = health?.isQueueCountBreached || health?.isThreadCountBreached || health?.hasStorageWarning;
              
              return (
                  <g key={clusterId}>
                      {/* Cluster Background Box */}
                      <rect 
                        x={colX.middleware - 20} 
                        y={clusterY} 
                        width={540} 
                        height={clusterHeight} 
                        rx="12" 
                        fill={isWarning ? "#FEF2F2" : "#F8FAFC"} 
                        stroke={isWarning ? "#EF4444" : "#E2E8F0"} 
                        strokeWidth={isWarning ? 2 : 1}
                        strokeDasharray={isWarning ? "0" : "4 4"}
                       />
                       
                       {/* Cluster Label Badge */}
                       <foreignObject x={colX.middleware} y={clusterY - 14} width="300" height="30">
                           <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-flex items-center gap-2 border ${isWarning ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                <ServerCog className="w-3 h-3" />
                                {cluster?.name}
                                {isWarning && <AlertTriangle className="w-3 h-3 ml-1" />}
                           </div>
                       </foreignObject>

                       {/* Cluster Stats Floating Badge */}
                       {health && (
                           <foreignObject x={colX.middleware + 300} y={clusterY - 14} width="200" height="60">
                               <div className="text-[10px] flex flex-col items-end gap-1">
                                   {health.isThreadCountBreached && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full">Threads Exceeded ({health.usedThreads}/{health.maxThreads})</span>}
                                   {!isSync && health.isQueueCountBreached && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full">Queues Exceeded ({health.activeQueues}/{health.maxQueues})</span>}
                                   {!isSync && health.hasStorageWarning && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full">Storage Full ({formatNumber(health.totalStorageUsedMB)}MB)</span>}
                               </div>
                           </foreignObject>
                       )}

                      {/* Render Individual Target Lanes within this Cluster */}
                      {clusterTargets.map((target, index) => {
                           const pathY = (targetYPositions.get(target.id) || 0) + 40; // Center
                           const targetQueues = result.queues.filter(q => q.targetId === target.id);
                           
                           // Use the first queue for aggregate target stats (simplified for 1:1 view)
                           const queueStats = targetQueues[0]; 

                           const effectiveInboundRPS = targetQueues.reduce((sum, q) => sum + q.inboundThroughputRecordsPerSec, 0);
                           const totalStorage = targetQueues.reduce((sum, q) => sum + q.maxQueueStorageMB, 0);
                           const maxCompletion = targetQueues.reduce((max, q) => Math.max(max, q.completionTimeSeconds), 0);
                           const outboundRPS = target.apiRateLimitRPM / 60;
                           const isCongested = effectiveInboundRPS > (outboundRPS * (targetQueues[0]?.payloadPerPacketKB || 100));
                           const isStorageOverflow = !isSync && health?.hasStorageWarning; 

                           // Check Throttling
                           const isThrottled = targetQueues.some(q => q.isThrottled);
                           const rejectionDelta = targetQueues.reduce((sum, q) => sum + (q.isThrottled ? (q.theoreticalInboundRPS - q.middlewareLimitRPS) : 0), 0);

                           // Sync Thread Analysis
                           // In Sync mode, we rely on the pre-calculated `isThreadBound` from calculator.ts
                           const isThreadBound = isSync && targetQueues.some(q => q.isThreadBound);
                           // Display the actual used threads
                           const activeThreads = queueStats ? Math.ceil(queueStats.usedThreads) : 0;
                           const maxThreads = config.mdgConcurrency;


                           return (
                               <g key={target.id}>
                                    {/* 1. bgRFC/Source Thread Node */}
                                    <foreignObject x={colX.rfc} y={pathY - 30} width="120" height="90">
                                        <div className={`h-full w-full border-2 rounded-lg p-2 flex flex-col items-center justify-center relative ${isThreadBound ? 'bg-red-50 border-red-300' : 'bg-indigo-50 border-indigo-200'}`}>
                                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-indigo-300"></div>
                                            <div className={`text-[10px] uppercase font-bold mb-1 ${isThreadBound ? 'text-red-800' : 'text-indigo-800'}`}>
                                                {isSync ? 'Active Connections' : 'bgRFC Queue'}
                                            </div>
                                            {isSync ? (
                                                <div className="flex flex-col items-center">
                                                    <div className={`flex items-center gap-1 text-xs ${isThreadBound ? 'text-red-600 font-bold' : 'text-indigo-600'}`}>
                                                        <Cable className="w-3 h-3" />
                                                        <span>{activeThreads} / {maxThreads}</span>
                                                    </div>
                                                    {isThreadBound && <div className="text-[8px] text-red-600 font-bold mt-0.5">POOL EXHAUSTED</div>}
                                                </div>
                                            ) : (
                                                <div className={`flex items-center gap-1 text-xs text-indigo-600`}>
                                                    <Cpu className="w-3 h-3" />
                                                    <span>{maxThreads} Threads</span>
                                                </div>
                                            )}
                                        </div>
                                    </foreignObject>

                                    {/* Line: MDG -> bgRFC */}
                                    <path d={`M ${colX.source + 140} ${canvasHeight / 2} C ${colX.source + 180} ${canvasHeight / 2}, ${colX.source + 180} ${pathY + 10}, ${colX.rfc} ${pathY + 10}`} 
                                        fill="none" stroke="#6366F1" strokeWidth="2" />

                                    {/* Link: bgRFC -> Interface */}
                                    {/* Warning if Rate Limited (Rejections) */}
                                    <line 
                                        x1={colX.rfc + 120} y1={pathY + 10} 
                                        x2={colX.middleware} y2={pathY + 10} 
                                        stroke={isThrottled ? "#EF4444" : "#9CA3AF"} 
                                        strokeWidth={isThrottled ? 3 : 2} 
                                        strokeDasharray={isThrottled ? "" : "5 5"} 
                                        markerEnd={isThrottled ? "url(#arrowhead-error)" : "url(#arrowhead)"} 
                                    />
                                    {isThrottled && (
                                        <foreignObject x={colX.rfc + 120 + 20} y={pathY - 25} width="80" height="40">
                                            <div className="bg-red-100 border border-red-300 text-red-700 rounded px-1 py-0.5 text-[8px] text-center shadow-sm font-bold flex flex-col">
                                                <span>RATE LIMITED</span>
                                                <span className="text-[7px]">-{formatNumber(rejectionDelta)} RPS</span>
                                            </div>
                                        </foreignObject>
                                    )}

                                     {/* 3. Interface */}
                                    <foreignObject x={colX.middleware} y={pathY - 40} width="140" height="100">
                                        <div className={`h-full w-full bg-white border ${isThrottled ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-300'} rounded-lg shadow-sm p-3 flex flex-col relative group transition-colors`}>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Interface</div>
                                            <div className="text-xs font-semibold text-gray-800 truncate" title={target.name}>{target.name} Inbound</div>
                                            {target.middlewareRateLimitEnabled && (
                                            <div className={`mt-2 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full w-fit ${isThrottled ? 'text-red-700 bg-red-100 font-bold' : 'text-orange-600 bg-orange-50'}`}>
                                                <ShieldAlert className="w-3 h-3" />
                                                Limit: {target.middlewareIngressRPM} RPM
                                            </div>
                                            )}
                                            {isThrottled && (
                                                <div className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow">
                                                    <Ban className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    </foreignObject>

                                    {/* Link: Interface -> (Queue OR iFlow) */}
                                    {!isSync ? (
                                        <>
                                            {/* ASYNC: Line to Queue */}
                                            <line x1={colX.middleware + 140} y1={pathY + 10} x2={colX.queue} y2={pathY + 10} stroke={isCongested ? "#EF4444" : "#4F46E5"} strokeWidth="2" markerEnd="url(#arrowhead-active)" className={isCongested ? "animate-pulse" : ""} />

                                            {/* 5. Queue Node */}
                                            <foreignObject x={colX.queue} y={pathY - 50} width="140" height="120">
                                                <div className={`h-full w-full bg-white border-2 rounded-lg shadow-sm p-2 flex flex-col items-center justify-center relative ${isStorageOverflow ? 'border-red-500 bg-red-50' : (totalStorage > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200')}`}>
                                                    <Layers className={`w-6 h-6 mb-1 ${isStorageOverflow ? 'text-red-600' : (totalStorage > 0 ? 'text-blue-600' : 'text-gray-300')}`} />
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-1">Target Queue</div>
                                                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-1">
                                                    <div className={`${isStorageOverflow ? 'bg-red-500' : 'bg-blue-500'} h-full`} style={{ width: '100%' }}></div> 
                                                    </div>
                                                    <div className={`text-xs font-mono ${isStorageOverflow ? 'text-red-700 font-bold' : 'text-blue-700'}`}>{formatNumber(totalStorage)} MB</div>
                                                    {isStorageOverflow && <div className="text-[9px] text-red-600 font-bold">CLUSTER FULL</div>}
                                                    <div className="text-[9px] text-gray-500 text-center mt-1">Wait: {formatDuration(maxCompletion)}</div>
                                                </div>
                                            </foreignObject>

                                            {/* Link: Queue -> iFlow */}
                                            <line x1={colX.queue + 140} y1={pathY + 10} x2={colX.iflow} y2={pathY + 10} stroke="#4F46E5" strokeWidth="2" markerEnd="url(#arrowhead-active)" />
                                        </>
                                    ) : (
                                        // SYNC: Direct line from Interface to iFlow
                                        <line x1={colX.middleware + 140} y1={pathY + 10} x2={colX.iflow} y2={pathY + 10} stroke="#4F46E5" strokeWidth="2" markerEnd="url(#arrowhead-active)" />
                                    )}

                                    {/* 7. iFlow */}
                                    <foreignObject x={colX.iflow} y={pathY - 30} width="100" height="80">
                                        <div className="h-full w-full bg-purple-50 border border-purple-200 rounded-lg p-2 flex flex-col items-center justify-center transform rotate-45 scale-75 shadow-sm">
                                            <div className="transform -rotate-45 flex flex-col items-center">
                                                <Workflow className="w-6 h-6 text-purple-600 mb-1" />
                                                <div className="text-[10px] font-bold text-purple-800">Map/Transform</div>
                                            </div>
                                        </div>
                                    </foreignObject>

                                    {/* Link: iFlow -> Target */}
                                    <line x1={colX.iflow + 100} y1={pathY + 10} x2={colX.target} y2={pathY + 10} stroke="#4F46E5" strokeWidth="2" markerEnd="url(#arrowhead-active)" />

                                    {/* 9. Target System */}
                                    <foreignObject x={colX.target} y={pathY - 40} width="130" height="100">
                                        <div className="h-full w-full bg-green-50 border border-green-200 rounded-lg shadow-sm p-3 flex flex-col justify-center items-center">
                                            <Server className="w-6 h-6 text-green-600 mb-2" />
                                            <div className="text-xs font-bold text-center text-green-900 leading-tight">{target.name}</div>
                                            <div className="text-[10px] text-green-600 mt-1">{target.replicationType}</div>
                                        </div>
                                    </foreignObject>
                               </g>
                           );
                      })}
                  </g>
              );
          })}

        </svg>
      </div>
    </div>
  );
};