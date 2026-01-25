import React from 'react';
import { Activity, Database, Clock, ArrowRight, Network, Zap, ShieldAlert } from 'lucide-react';

export const FormulaReference: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Calculation Logic & Formulas</h2>
        <p className="text-gray-600 mb-8 border-b border-gray-100 pb-6">
          The application simulates the data replication process by modeling the flow from the Source System (MDG)
          through the Middleware to Target Systems. Below is a breakdown of the variables and formulas used to generate the results.
        </p>

        <div className="space-y-10">
            
            {/* Section 1: Inbound */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Activity className="w-5 h-5" /> 1. Source System Inbound Load (MDG → Middleware)
                </h3>
                <p className="text-sm text-gray-600">
                    Inbound Load is calculated <strong>per target interface</strong>. MDG allocates a pool of threads for each target system connection.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <p className="font-medium text-gray-900">Step A: Theoretical Max Speed (Per Interface)</p>
                        </div>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           (1000 / Avg_Middleware_Response_Time_ms) * MDG_Concurrency_Threads
                        </code>
                    </div>

                    <div>
                         <div className="flex justify-between items-baseline mb-1">
                            <p className="font-medium text-gray-900 flex items-center gap-2">
                                Step B: Middleware Rate Limiting (Optional) <ShieldAlert className="w-4 h-4 text-orange-500" />
                            </p>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                            If Middleware Rate Limiting is enabled for a specific target, the Inbound RPS is capped.
                        </p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           Effective_Inbound_RPS = MIN( Theoretical_Max_Speed, Middleware_Limit_RPM / 60 )
                        </code>
                    </div>

                    <div>
                        <p className="font-medium text-gray-900">Step C: Inbound Ingestion Rate</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           Effective_Inbound_RPS * Packet_Size
                        </code>
                    </div>
                </div>
            </section>

            {/* Section 2: Outbound */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5" /> 2. Target System Consumption (Middleware → Target)
                </h3>
                <p className="text-sm text-gray-600">
                    Calculates how fast data leaves the middleware based on API rate limits.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <p className="font-medium text-gray-900">Outbound Processing Rate (Records/sec)</p>
                        <p className="text-xs text-gray-500 mb-2">Derived from the Target System's API Rate Limit (Requests Per Minute).</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           (Target_API_Rate_Limit_RPM / 60) * Packet_Size
                        </code>
                    </div>
                </div>
            </section>

             {/* Section 3: Queue */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Database className="w-5 h-5" /> 3. Queue Capacity & Storage
                </h3>
                <p className="text-sm text-gray-600">
                    Queues accumulate per target when the specific interface Inbound Rate is faster than the Target's Consumption Rate.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <p className="font-medium text-gray-900">Max Queue Depth (Records)</p>
                        <p className="text-xs text-gray-500 mb-2">
                             Calculated only if Effective Inbound Rate &gt; Outbound Rate.
                        </p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           (Effective_Inbound_Rate - Outbound_Rate) * Ingestion_Duration
                        </code>
                    </div>
                </div>
            </section>

             {/* Section 4: Network & Time */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Clock className="w-5 h-5" /> 4. Network & Timelines
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <div>
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                             <Network className="w-4 h-4 text-gray-500" /> Required Network Throughput (MB/s)
                        </p>
                        <p className="text-xs text-gray-500 mb-2">Sum of bandwidth across all active target interfaces.</p>
                        <code className="block bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                           (SUM(Effective_Inbound_RPS_All_Targets) * Max_Packet_Payload_KB) / 1024
                        </code>
                    </div>
                </div>
            </section>

             {/* Section 5: Replication Modes */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
                    <Zap className="w-5 h-5" /> 5. Replication Modes (Realtime vs Scheduled)
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                    <p className="text-sm text-gray-600 mb-4">
                        The calculator handles "Realtime" and "Scheduled" modes identically regarding queue consumption, 
                        modeling the Middleware as an <strong>always-on listener</strong>. The difference lies in how the data arrival (Source) is conceptualized.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-2">Realtime Replication</p>
                            <p className="text-xs text-gray-500">
                                <strong>Scenario:</strong> Individual records are sent continuously.
                                <br/><br/>
                                <strong>Calculation Interpretation:</strong> The "Volume" input is treated as a <strong>Peak Load Test</strong> (e.g. 500k records during a busy hour or initial migration). The calculator estimates if the queue can drain fast enough to handle this specific surge.
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-2">Scheduled (Batch) Replication</p>
                            <p className="text-xs text-gray-500">
                                <strong>Scenario:</strong> Records accumulate and are pushed in a batch every interval (e.g. 15 mins).
                                <br/><br/>
                                <strong>Calculation Interpretation:</strong> The Source pushes the entire batch ("Volume") as fast as possible (burst). The Middleware <strong>immediately</strong> begins consuming this queue based on the Target API Rate Limit. It does not wait for the interval to finish.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

        </div>
      </div>
    </div>
  );
};