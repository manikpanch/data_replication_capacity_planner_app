import React from 'react';
import { Activity, Database, Clock, ArrowRight, Network, Zap, ShieldAlert, Split, ServerCog } from 'lucide-react';

export const FormulaReference: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Calculation Logic & Formulas</h2>
        <p className="text-gray-600 mb-8 border-b border-gray-100 pb-6">
          The application simulates the data replication process by modeling the flow from the Source System (MDG)
          through the Middleware to Target Systems. With the introduction of packet splitting and cluster limits, the logic follows these steps:
        </p>

        <div className="space-y-10">

            {/* Section 0: Packet Splitting */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Split className="w-5 h-5" /> 1. Packet Optimization & Splitting
                </h3>
                <p className="text-sm text-gray-600">
                    If the Source (MDG) sends packets larger than what the Target System accepts, the Middleware must split the message.
                    This acts as a multiplier for downstream processing time.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="font-medium text-gray-900">Effective Target Packet</p>
                            <code className="block bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1">
                               MIN(Source_Packet_Size, Target_Max_Packet_Size)
                            </code>
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">Split Factor (Calls per MDG Request)</p>
                            <code className="block bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1">
                               CEIL(Source_Packet_Size / Effective_Target_Packet)
                            </code>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Section 2: Async Logic */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Database className="w-5 h-5" /> 2. Asynchronous Mode (Queued) Logic
                </h3>
                <p className="text-sm text-gray-600">
                    In Async mode, MDG fires and forgets. The Middleware absorbs the load into queues.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <p className="font-medium text-gray-900">Inbound Rate (MDG → Queue)</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           MIN( (1000/Middleware_Overhead_ms) * Threads, Middleware_Ingress_Limit )
                        </code>
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">Outbound Rate (Queue → Target)</p>
                        <p className="text-xs text-gray-500 mb-1">Limited by Target RPM and the effective packet size it can accept.</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           (Target_RPM / 60) * Effective_Target_Packet
                        </code>
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">Queue Accumulation</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           MAX(0, Inbound_Rate_Recs - Outbound_Rate_Recs) * Total_Ingestion_Time
                        </code>
                    </div>
                </div>
            </section>

             {/* Section 3: Sync Logic */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5" /> 3. Synchronous Mode (Request-Reply) Logic
                </h3>
                <p className="text-sm text-gray-600">
                    In Sync mode, MDG waits. The Middleware must sequentially call the Target `Split_Factor` times before responding to MDG.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                         <p className="font-medium text-gray-900">Total Round Trip Time (RTT)</p>
                         <p className="text-xs text-gray-500 mb-1">Time an MDG Thread is locked waiting for response.</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           Middleware_Overhead + (Split_Factor * (60 / Target_RPM))
                        </code>
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">Effective Throughput</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           MIN( MDG_Threads / Total_RTT, (Target_RPM/60)/Split_Factor )
                        </code>
                    </div>
                     <div>
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-orange-500" /> Thread Utilization
                        </p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           = MDG_Threads (Configured Concurrency)
                        </code>
                        <p className="text-xs text-gray-500 mt-1">
                            In Sync mode, if MDG opens a connection, the Middleware holds a thread even if waiting for a slow target. 
                            The calculator assumes allocated capacity (worst-case) rather than just active processing time.
                        </p>
                    </div>
                </div>
            </section>

             {/* Section 4: Cluster & Network */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <ServerCog className="w-5 h-5" /> 4. Cluster & Network Health
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <p className="font-medium text-gray-900">Cluster Utilization</p>
                             <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                                 <li><strong>Threads:</strong> Sum of allocated threads (MDG Concurrency) across all targets assigned to the cluster.</li>
                                 <li><strong>Queues:</strong> Count of active async interfaces.</li>
                                 <li><strong>Storage:</strong> Sum of Peak Queue Size (MB) for all async queues.</li>
                             </ul>
                        </div>
                        <div>
                             <p className="font-medium text-gray-900">Network Bandwidth</p>
                             <code className="block bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1">
                                (Total_Inbound_RPS * Source_Packet_KB) / 1024
                             </code>
                             <p className="text-xs text-gray-500 mt-1">Calculated based on the heavy Source Packet size before splitting.</p>
                        </div>
                     </div>
                </div>
            </section>

        </div>
      </div>
    </div>
  );
};