import React, { useMemo } from 'react';
import { Download, Activity, Database, Clock, Server, HelpCircle, Network, ServerCog, AlertTriangle, CheckCircle2, Ban, Lightbulb, TrendingUp, AlertOctagon } from 'lucide-react';
import { MasterDataObject, TargetSystem, Mapping, GlobalConfig, MiddlewareCluster } from '../types';
import { calculateSimulation, formatDuration, formatNumber } from '../services/calculator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tooltip } from './Tooltip';

interface ResultsDashboardProps {
  mdos: MasterDataObject[];
  targets: TargetSystem[];
  clusters: MiddlewareCluster[];
  mappings: Mapping[];
  config: GlobalConfig;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  mdos, targets, clusters, mappings, config
}) => {
  const result = useMemo(() => 
    calculateSimulation(mdos, targets, mappings, config, clusters),
    [mdos, targets, mappings, config, clusters]
  );
  
  const isSync = config.integrationPattern === 'SYNC';

  // --- Insight Generation Logic ---
  const generateInsights = () => {
    const insights: { type: 'info' | 'warning' | 'success', text: string }[] = [];
    const limitingQueue = result.queues.reduce((prev, current) => (prev.completionTimeSeconds > current.completionTimeSeconds) ? prev : current, result.queues[0]);

    if (!limitingQueue) return [];

    if (isSync) {
        // SYNC INSIGHTS
        const totalThreadUsage = result.clusterHealth.reduce((sum, c) => sum + c.usedThreads, 0);
        const totalCapacity = result.clusterHealth.reduce((sum, c) => sum + c.maxThreads, 0);
        const utilization = (totalThreadUsage / totalCapacity) * 100;
        const avgSplit = result.queues.reduce((sum, q) => sum + q.splitFactor, 0) / (result.queues.length || 1);

        if (limitingQueue.isThreadBound) {
             insights.push({
                type: 'warning',
                text: `Bottleneck: Middleware Thread Pool. The combination of high latency and packet splitting is exhausting available threads. MDG cannot open new connections because all threads are busy waiting for responses.`
            });
        } else {
             insights.push({
                type: 'info',
                text: `Bottleneck: Target System Rate Limits. Your middleware clusters have plenty of spare capacity (${formatNumber(100 - utilization)}% free threads), but MDG is throttled because the Target Systems cannot accept data fast enough.`
            });
        }

        if (avgSplit > 1.5) {
             insights.push({
                type: 'info',
                text: `Packet Splitting Impact: On average, every 1 request from MDG requires ~${formatNumber(avgSplit)} calls to the Target. This multiplies the Round Trip Time, locking threads for longer durations.`
            });
        }

    } else {
        // ASYNC INSIGHTS
        const totalStorage = result.totalStorageRequiredMB;
        const storageLimit = result.clusterHealth.reduce((sum, c) => sum + c.maxStorageMB, 0);
        
        if (result.maxApiLoadRPS > limitingQueue.outboundProcessingRateRecordsPerSec / limitingQueue.effectiveTargetPacketSize) {
             insights.push({
                type: 'warning',
                text: `Queue Buildup: Data is entering the middleware faster than it can leave. Queues will grow until the entire source volume is ingested, then drain slowly based on Target constraints.`
            });
        }

        if (totalStorage > storageLimit) {
             insights.push({
                type: 'warning',
                text: `Storage Critical: The estimated queue size (${formatNumber(totalStorage)} MB) exceeds the total cluster capacity (${formatNumber(storageLimit)} MB). Data loss or broker failure is likely.`
            });
        } else {
             insights.push({
                type: 'success',
                text: `Storage Healthy: Peak queue accumulation is within limits. The middleware acts as a successful buffer between the fast Source and slow Target.`
            });
        }
    }

    // Throttling Check
    const throttledCount = result.queues.filter(q => q.isThrottled).length;
    if (throttledCount > 0) {
        insights.push({
            type: 'warning',
            text: `Throttling Active: ${throttledCount} interfaces are being artificially slowed down by the "Middleware Ingress Limit" setting, which protects the cluster from overload.`
        });
    }

    return insights;
  };

  const insights = generateInsights();

  const downloadReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Master Data Replication through Middleware Planner', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Mode: ${isSync ? 'Synchronous (Request-Response)' : 'Asynchronous (Queued)'}`, 14, 34);

    // Global Stats
    doc.setFontSize(12);
    doc.text('Executive Summary', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Max API Load (Inbound)', `${formatNumber(result.maxApiLoadRPS)} RPS`],
        ['Required Network Throughput', `${formatNumber(result.requiredNetworkThroughputMBPS)} MB/s`],
        ['Total API Requests', formatNumber(result.totalApiRequests)],
        ['Total Queue Storage', isSync ? 'N/A' : `${formatNumber(result.totalStorageRequiredMB)} MB`],
        ['Longest Replication Time', formatDuration(result.overallCompletionTimeSeconds)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Cluster Health Table
    const clusterY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('Middleware Cluster Health', 14, clusterY);
    const clusterRows = result.clusterHealth.map(c => [
        c.clusterName,
        isSync ? 'N/A' : `${c.activeQueues} / ${c.maxQueues} ${c.isQueueCountBreached ? '(FAIL)' : ''}`,
        `${c.usedThreads} / ${c.maxThreads} ${c.isThreadCountBreached ? '(FAIL)' : ''}`,
        isSync ? 'N/A' : (c.hasStorageWarning ? `${formatNumber(c.totalStorageUsedMB)} MB (FAIL)` : `${formatNumber(c.totalStorageUsedMB)} MB`)
    ]);
    autoTable(doc, {
        startY: clusterY + 5,
        head: [['Cluster', 'Active Queues', 'Thread Utilization', 'Storage Usage']],
        body: clusterRows,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] } // Orange
    });

    // Detailed Table
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('Detailed Analysis', 14, finalY);

    const rows = result.queues.map(q => [
      q.targetName,
      q.mdoName,
      formatNumber(q.totalRecords),
      q.splitFactor > 1 ? `1 : ${q.splitFactor}` : '1 : 1',
      q.isThrottled ? `YES (-${formatNumber(q.theoreticalInboundRPS - q.middlewareLimitRPS)} RPS)` : 'No',
      isSync ? `${Math.ceil(q.usedThreads)} / ${config.mdgConcurrency}` : 'N/A',
      isSync ? 'N/A' : `${formatNumber(q.maxQueueStorageMB)}`,
      formatDuration(q.completionTimeSeconds)
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Target System', 'Object', 'Volume', 'Packet Split', 'Throttling', 'Active Threads', 'Queue Storage (MB)', 'Time to Complete']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save('middleware-capacity-plan.pdf');
  };

  // Prepare Chart Data
  const chartData = targets.map(t => {
    const targetQueues = result.queues.filter(q => q.targetName === t.name);
    const totalTime = targetQueues.reduce((max, q) => Math.max(max, q.completionTimeSeconds), 0);
    const totalStorage = targetQueues.reduce((sum, q) => sum + q.maxQueueStorageMB, 0);
    return {
      name: t.name,
      timeSeconds: totalTime,
      storageMB: totalStorage,
      displayTime: formatDuration(totalTime) // For tooltips
    };
  });

  const verticalChartHeight = Math.max(300, chartData.length * 60);

  return (
    <div className="space-y-6">
      
      {/* Top Cards - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-sm font-medium text-gray-500">Peak API Load</p>
              <Tooltip text="Maximum estimated requests per second hitting the middleware from MDG">
                <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
              </Tooltip>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(result.maxApiLoadRPS)}</h3>
            <p className="text-xs text-gray-400 mt-1">Requests / Sec</p>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-sm font-medium text-gray-500">Req. Throughput</p>
              <Tooltip text="Peak network bandwidth required (Max RPS * Max Packet Size)">
                <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
              </Tooltip>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(result.requiredNetworkThroughputMBPS)}</h3>
            <p className="text-xs text-gray-400 mt-1">MB / Sec</p>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Network className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-sm font-medium text-gray-500">
                  {isSync ? 'Total Data Volume' : 'Max Queue Storage'}
              </p>
              <Tooltip text={isSync ? "Total size of all data being moved" : "Estimated maximum peak storage required on the middleware across all queues"}>
                <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
              </Tooltip>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {isSync ? 'N/A' : formatNumber(result.totalStorageRequiredMB)}
            </h3>
            <p className="text-xs text-gray-400 mt-1">Megabytes (MB)</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Database className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Reasoning Summary Section */}
      {insights.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-indigo-600" /> 
                Simulation Reasoning & Insights
            </h4>
            <div className="space-y-3">
                {insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                        {insight.type === 'warning' ? (
                             <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        ) : insight.type === 'success' ? (
                             <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                             <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {insight.text}
                        </p>
                    </div>
                ))}
            </div>
          </div>
      )}

      {/* Cluster Health Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
              <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <ServerCog className="w-5 h-5" /> Middleware Cluster Health
                  <Tooltip text="Comparison of estimated load vs configured cluster capacity.">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                  </Tooltip>
              </h4>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6">
              {result.clusterHealth.map(health => {
                  const isCritical = health.isQueueCountBreached || health.isThreadCountBreached || health.hasStorageWarning;
                  return (
                      <div key={health.clusterId} className={`border rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 ${isCritical ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                          <div className="flex items-center gap-3">
                              {isCritical ? <AlertTriangle className="w-8 h-8 text-red-600" /> : <CheckCircle2 className="w-8 h-8 text-green-600" />}
                              <div>
                                  <h5 className="font-bold text-gray-800">{health.clusterName}</h5>
                                  <p className="text-sm text-gray-600">
                                      {isCritical ? 'Capacity constraints exceeded.' : 'Operating within limits.'}
                                  </p>
                              </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm">
                              <div className={`px-4 py-2 rounded-lg border ${health.isThreadCountBreached ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-gray-200'}`}>
                                  <span className="block text-xs font-semibold uppercase opacity-70">Threads</span>
                                  <span className="font-mono text-lg font-bold">{health.usedThreads}</span> / {health.maxThreads}
                              </div>
                              
                              {!isSync && (
                                  <>
                                    <div className={`px-4 py-2 rounded-lg border ${health.isQueueCountBreached ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-gray-200'}`}>
                                        <span className="block text-xs font-semibold uppercase opacity-70">Active Queues</span>
                                        <span className="font-mono text-lg font-bold">{health.activeQueues}</span> / {health.maxQueues}
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg border ${health.hasStorageWarning ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-gray-200'}`}>
                                        <span className="block text-xs font-semibold uppercase opacity-70">Cluster Storage</span>
                                        <span className="font-bold">{formatNumber(health.totalStorageUsedMB)}</span> / {formatNumber(health.maxStorageMB)} MB
                                    </div>
                                  </>
                              )}
                          </div>
                      </div>
                  )
              })}
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
             <h4 className="text-lg font-semibold text-gray-800">Replication Time by System</h4>
          </div>
          <div style={{ height: `${verticalChartHeight}px`, minHeight: '300px' }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} />
                <RechartsTooltip formatter={(value: any, name: any, props: any) => [props.payload.displayTime, 'Time']} />
                <Legend />
                <Bar dataKey="timeSeconds" name="Duration (Seconds)" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-lg font-semibold text-gray-800">
                {isSync ? 'Data Volume per System (MB)' : 'Peak Queue Storage (MB)'}
            </h4>
          </div>
          <div className="h-96">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip formatter={(value: number) => [`${value.toFixed(2)} MB`, isSync ? 'Total Data' : 'Peak Queue']} />
                <Legend />
                <Bar dataKey="storageMB" name={isSync ? 'Total Volume (MB)' : 'Queue Storage (MB)'} fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h4 className="text-lg font-semibold text-gray-800">Detailed Queue Analysis</h4>
          <button 
            onClick={downloadReport}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 transition"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target System</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (Recs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Packet Split</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Throttling</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Threads (Conn)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Queue Storage (MB)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {result.queues.map((q, idx) => (
                <tr key={`${q.targetName}-${q.mdoName}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{q.targetName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.mdoName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatNumber(q.totalRecords)}</td>
                  
                  {/* Split Column */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {q.splitFactor > 1 ? (
                          <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">1 : {q.splitFactor}</span>
                      ) : (
                          <span className="text-gray-400">1 : 1</span>
                      )}
                  </td>

                  {/* Throttling Column */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {q.isThrottled ? (
                         <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 rounded w-fit border border-red-100">
                            <Ban className="w-3 h-3" />
                            YES (-{formatNumber(q.theoreticalInboundRPS - q.middlewareLimitRPS)} RPS)
                         </div>
                      ) : (
                         <span className="text-gray-400 text-xs">None</span>
                      )}
                  </td>
                  
                  {/* Threads Column */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {isSync ? (
                          <span className={q.isThreadBound ? 'text-red-600 font-bold' : 'text-gray-700'}>
                              {Math.ceil(q.usedThreads)} / {config.mdgConcurrency}
                          </span>
                      ) : (
                          <span className="text-gray-400">-</span>
                      )}
                  </td>

                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${!isSync && q.isStorageOverflow ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {isSync ? '-' : formatNumber(q.maxQueueStorageMB)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium text-indigo-600">{formatDuration(q.completionTimeSeconds)}</td>
                </tr>
              ))}
              {result.queues.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No active mappings configured. Please check the Configuration tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};