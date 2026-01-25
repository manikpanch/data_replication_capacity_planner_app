import React, { useRef } from 'react';
import { Plus, Trash2, HelpCircle, Clock, Zap, Upload, FileSpreadsheet, ShieldAlert, ServerCog, ArrowRightLeft, Spline } from 'lucide-react';
import { MasterDataObject, TargetSystem, Mapping, GlobalConfig, MiddlewareCluster } from '../types';
import { Tooltip } from './Tooltip';
import * as XLSX from 'xlsx';

interface ConfigFormProps {
  mdos: MasterDataObject[];
  setMdos: React.Dispatch<React.SetStateAction<MasterDataObject[]>>;
  targets: TargetSystem[];
  setTargets: React.Dispatch<React.SetStateAction<TargetSystem[]>>;
  clusters: MiddlewareCluster[];
  setClusters: React.Dispatch<React.SetStateAction<MiddlewareCluster[]>>;
  mappings: Mapping[];
  setMappings: React.Dispatch<React.SetStateAction<Mapping[]>>;
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({
  mdos, setMdos, targets, setTargets, clusters, setClusters, mappings, setMappings, config, setConfig
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MDO HANDLERS ---
  const addMdo = () => {
    const newId = crypto.randomUUID();
    const newMdo: MasterDataObject = {
      id: newId,
      name: `MDO ${mdos.length + 1}`,
      volume: 10000,
      packetSize: 100,
      payloadSizePerRecordKB: 2
    };
    setMdos([...mdos, newMdo]);
    const newMappings = targets.map(t => ({ mdoId: newId, targetId: t.id, active: true }));
    setMappings([...mappings, ...newMappings]);
  };

  const removeMdo = (id: string) => {
    setMdos(mdos.filter(m => m.id !== id));
    setMappings(mappings.filter(m => m.mdoId !== id));
  };

  const updateMdo = (id: string, field: keyof MasterDataObject, value: string | number) => {
    setMdos(mdos.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // --- CLUSTER HANDLERS ---
  const addCluster = () => {
    const newId = crypto.randomUUID();
    const newCluster: MiddlewareCluster = {
      id: newId,
      name: `Middleware Cluster ${clusters.length + 1}`,
      maxThreads: 50,
      maxQueues: 20,
      maxQueueCapacityMB: 5000
    };
    setClusters([...clusters, newCluster]);
  };

  const removeCluster = (id: string) => {
    // Prevent deletion if in use
    const isUsed = targets.some(t => t.middlewareClusterId === id);
    if (isUsed) {
        alert("Cannot delete this cluster because it is assigned to one or more Target Systems.");
        return;
    }
    setClusters(clusters.filter(c => c.id !== id));
  };

  const updateCluster = (id: string, field: keyof MiddlewareCluster, value: string | number) => {
    setClusters(clusters.map(c => c.id === id ? { ...c, [field]: value } : c));
  };


  // --- TARGET HANDLERS ---
  const addTarget = () => {
    if (clusters.length === 0) {
        alert("Please create a Middleware Cluster first.");
        return;
    }
    const newId = crypto.randomUUID();
    const newTarget: TargetSystem = {
      id: newId,
      middlewareClusterId: clusters[0].id,
      name: `Target ${targets.length + 1}`,
      apiRateLimitRPM: 300,
      targetPacketSize: 100,
      replicationType: 'Realtime',
      middlewareRateLimitEnabled: false,
      middlewareIngressRPM: 30
    };
    setTargets([...targets, newTarget]);
    const newMappings = mdos.map(m => ({ mdoId: m.id, targetId: newId, active: true }));
    setMappings([...mappings, ...newMappings]);
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
    setMappings(mappings.filter(m => m.targetId !== id));
  };

  const updateTarget = (id: string, field: keyof TargetSystem, value: string | number | boolean) => {
    setTargets(targets.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const toggleMapping = (mdoId: string, targetId: string) => {
    setMappings(prev => {
      const existing = prev.find(m => m.mdoId === mdoId && m.targetId === targetId);
      if (existing) {
        return prev.map(m => m.mdoId === mdoId && m.targetId === targetId ? { ...m, active: !m.active } : m);
      }
      return [...prev, { mdoId, targetId, active: true }];
    });
  };

  const inputClass = "w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2";
  const tableInputClass = "w-full bg-white text-gray-900 border border-gray-300 rounded focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5";

  return (
    <div className="space-y-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      
      {/* Global Config */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          Global Settings
          <Tooltip text="Configuration affecting the entire replication process">
            <HelpCircle className="w-4 h-4 ml-2 text-gray-400 cursor-help" />
          </Tooltip>
        </h3>
        
        {/* Integration Pattern Selection */}
        <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
             <label className="text-sm font-bold text-indigo-900 mb-2 block">Middleware Integration Pattern</label>
             <div className="flex gap-4">
                 <button
                    onClick={() => setConfig({ ...config, integrationPattern: 'ASYNC' })}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${config.integrationPattern === 'ASYNC' ? 'border-indigo-600 bg-white shadow-md' : 'border-transparent hover:bg-white/50'}`}
                 >
                     <div className="flex items-center gap-2 mb-1">
                        <Spline className={`w-5 h-5 ${config.integrationPattern === 'ASYNC' ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className={`font-semibold ${config.integrationPattern === 'ASYNC' ? 'text-indigo-900' : 'text-gray-600'}`}>Asynchronous (Queued)</span>
                     </div>
                     <p className="text-xs text-gray-500">Fire-and-forget from MDG. Middleware queues data. Higher throughput, potential storage overflow.</p>
                 </button>
                 
                 <button
                    onClick={() => setConfig({ ...config, integrationPattern: 'SYNC' })}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${config.integrationPattern === 'SYNC' ? 'border-indigo-600 bg-white shadow-md' : 'border-transparent hover:bg-white/50'}`}
                 >
                     <div className="flex items-center gap-2 mb-1">
                        <ArrowRightLeft className={`w-5 h-5 ${config.integrationPattern === 'SYNC' ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <span className={`font-semibold ${config.integrationPattern === 'SYNC' ? 'text-indigo-900' : 'text-gray-600'}`}>Synchronous (Request-Reply)</span>
                     </div>
                     <p className="text-xs text-gray-500">MDG waits for Target response. No Middleware Queues. Lower throughput, risk of thread exhaustion.</p>
                 </button>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              Middleware Processing Overhead (ms)
              <Tooltip text="Time for middleware to process/transform a message, excluding network wait time.">
                <HelpCircle className="w-4 h-4 ml-2 text-gray-400 cursor-help" />
              </Tooltip>
            </label>
            <input
              type="number"
              value={config.avgMiddlewareResponseTimeMs}
              onChange={(e) => setConfig({...config, avgMiddlewareResponseTimeMs: Number(e.target.value)})}
              className={inputClass}
            />
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              MDG Concurrency (Threads per Target)
              <Tooltip text="Number of parallel connections MDG opens per target system interface.">
                <HelpCircle className="w-4 h-4 ml-2 text-gray-400 cursor-help" />
              </Tooltip>
            </label>
            <input
              type="number"
              value={config.mdgConcurrency}
              onChange={(e) => setConfig({...config, mdgConcurrency: Number(e.target.value)})}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* Middleware Clusters */}
      <section>
         <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ServerCog className="w-5 h-5" /> Middleware Clusters
            <Tooltip text="Define runtime environments (e.g., CPI Tenant, MuleSoft Region) and their capacity.">
                <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            </Tooltip>
          </h3>
          <button
            onClick={addCluster}
            className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Cluster
          </button>
        </div>
        
        <div className="overflow-x-auto border border-gray-200 rounded-lg mb-8">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cluster Name</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Max Threads</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Max Queues</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Cluster Storage (MB)</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {clusters.map(c => (
                        <tr key={c.id}>
                            <td className="px-3 py-2 bg-gray-50">
                                <input type="text" value={c.name} onChange={(e) => updateCluster(c.id, 'name', e.target.value)} className={tableInputClass} />
                            </td>
                            <td className="px-3 py-2 bg-gray-50">
                                <input type="number" value={c.maxThreads} onChange={(e) => updateCluster(c.id, 'maxThreads', Number(e.target.value))} className={tableInputClass} />
                            </td>
                            <td className="px-3 py-2 bg-gray-50">
                                <input type="number" value={c.maxQueues} onChange={(e) => updateCluster(c.id, 'maxQueues', Number(e.target.value))} className={tableInputClass} />
                            </td>
                            <td className="px-3 py-2 bg-gray-50">
                                <input type="number" value={c.maxQueueCapacityMB} onChange={(e) => updateCluster(c.id, 'maxQueueCapacityMB', Number(e.target.value))} className={tableInputClass} />
                            </td>
                            <td className="px-3 py-2 text-right bg-gray-50">
                                <button onClick={() => removeCluster(c.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="w-4 h-4" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </section>

      {/* ... Rest of ConfigForm (Targets, MDOs, Mapping) remains unchanged ... */}
      <hr className="border-gray-200" />

      {/* Target Systems */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Target Systems</h3>
          <button
            onClick={addTarget}
            className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Target
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => (
            <div key={target.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative group shadow-sm">
              <button
                onClick={() => removeTarget(target.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase">System Name</label>
                <input
                  type="text"
                  value={target.name}
                  onChange={(e) => updateTarget(target.id, 'name', e.target.value)}
                  className="mt-1 block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                />
              </div>

              <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                    Assigned Cluster
                    <Tooltip text="The middleware runtime environment processing this target's data.">
                        <HelpCircle className="w-3 h-3 ml-1" />
                    </Tooltip>
                  </label>
                  <select 
                    value={target.middlewareClusterId}
                    onChange={(e) => updateTarget(target.id, 'middlewareClusterId', e.target.value)}
                    className="mt-1 block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                  >
                      {clusters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                      Target Rate Limit
                      <Tooltip text="Maximum Requests Per Minute (RPM) accepted by the target system">
                        <HelpCircle className="w-3 h-3 ml-1" />
                      </Tooltip>
                    </label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={target.apiRateLimitRPM}
                        onChange={(e) => updateTarget(target.id, 'apiRateLimitRPM', Number(e.target.value))}
                        className="block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                      />
                      <span className="text-xs text-gray-500">RPM</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                      Max Packet Size
                      <Tooltip text="Max records per single API call to Target. If smaller than MDG packet, Middleware splits the message.">
                        <HelpCircle className="w-3 h-3 ml-1" />
                      </Tooltip>
                    </label>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={target.targetPacketSize || 100}
                        onChange={(e) => updateTarget(target.id, 'targetPacketSize', Number(e.target.value))}
                        className="block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                      />
                      <span className="text-xs text-gray-500">recs</span>
                    </div>
                  </div>
              </div>

              {/* Middleware Constraints */}
              <div className="mb-4 p-3 bg-indigo-50 rounded border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                     <label className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-1">
                         <ShieldAlert className="w-3 h-3" /> Middleware Rate Limit
                     </label>
                     <div className="relative inline-block w-8 h-4 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name={`toggle-${target.id}`} 
                            id={`toggle-${target.id}`} 
                            checked={target.middlewareRateLimitEnabled || false}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                setTargets(prev => prev.map(t => {
                                    if (t.id === target.id) {
                                        return {
                                            ...t, 
                                            middlewareRateLimitEnabled: checked,
                                            // Set default to 30 RPM if enabling and value is falsy
                                            middlewareIngressRPM: checked && (!t.middlewareIngressRPM) ? 30 : t.middlewareIngressRPM
                                        };
                                    }
                                    return t;
                                }));
                            }}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{ right: target.middlewareRateLimitEnabled ? '0' : '50%', borderColor: target.middlewareRateLimitEnabled ? '#4F46E5' : '#D1D5DB' }}
                        />
                        <label htmlFor={`toggle-${target.id}`} className={`toggle-label block overflow-hidden h-4 rounded-full cursor-pointer ${target.middlewareRateLimitEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}></label>
                    </div>
                </div>
                {target.middlewareRateLimitEnabled && (
                    <div className="animate-fadeIn mt-2">
                         <label className="text-xs text-indigo-600 mb-1 flex items-center">
                            Max Ingress RPM
                            <Tooltip text="Middleware will throttle MDG to this rate.">
                                <HelpCircle className="w-3 h-3 ml-1 cursor-help" />
                            </Tooltip>
                         </label>
                         <div className="flex items-center gap-2">
                             <input 
                                type="number"
                                value={target.middlewareIngressRPM || 0}
                                onChange={(e) => updateTarget(target.id, 'middlewareIngressRPM', Number(e.target.value))}
                                className="block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1.5"
                             />
                             <span className="text-xs text-gray-500">RPM</span>
                         </div>
                    </div>
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-200">
                 <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Source Replication Mode</label>
                    <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateTarget(target.id, 'replicationType', 'Realtime')}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium rounded border ${
                            target.replicationType === 'Realtime' 
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-800' 
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                           <Zap className="w-3 h-3" /> Realtime
                        </button>
                        <button
                          onClick={() => updateTarget(target.id, 'replicationType', 'Scheduled')}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium rounded border ${
                            target.replicationType === 'Scheduled' 
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-800' 
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                           <Clock className="w-3 h-3" /> Scheduled
                        </button>
                    </div>
                 </div>

                 {target.replicationType === 'Scheduled' && (
                   <div className="animate-fadeIn">
                      <label className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                        Schedule Interval
                        <Tooltip text="Time between batch executions from MDG">
                          <HelpCircle className="w-3 h-3 ml-1" />
                        </Tooltip>
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={target.scheduleIntervalMinutes || 0}
                          onChange={(e) => updateTarget(target.id, 'scheduleIntervalMinutes', Number(e.target.value))}
                          className="block w-full bg-white text-gray-900 border border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
                          placeholder="Minutes"
                        />
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-gray-200" />

       {/* Master Data Objects */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Master Data Objects (MDG Source)</h3>
          <button
            onClick={addMdo}
            className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> Add MDO
          </button>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Object Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Volume (Records)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Packet Size</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Record Size (KB)</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mdos.map((mdo) => (
                <tr key={mdo.id}>
                  <td className="px-3 py-2 bg-gray-50">
                    <input
                      type="text"
                      value={mdo.name}
                      onChange={(e) => updateMdo(mdo.id, 'name', e.target.value)}
                      className={tableInputClass}
                      placeholder="e.g. Customer"
                    />
                  </td>
                  <td className="px-3 py-2 bg-gray-50">
                    <input
                      type="number"
                      value={mdo.volume}
                      onChange={(e) => updateMdo(mdo.id, 'volume', Number(e.target.value))}
                      className={tableInputClass}
                    />
                  </td>
                  <td className="px-3 py-2 bg-gray-50">
                    <input
                      type="number"
                      value={mdo.packetSize}
                      onChange={(e) => updateMdo(mdo.id, 'packetSize', Number(e.target.value))}
                      className={tableInputClass}
                    />
                  </td>
                  <td className="px-3 py-2 bg-gray-50">
                    <input
                      type="number"
                      value={mdo.payloadSizePerRecordKB}
                      onChange={(e) => updateMdo(mdo.id, 'payloadSizePerRecordKB', Number(e.target.value))}
                      className={tableInputClass}
                    />
                  </td>
                  <td className="px-3 py-2 text-right bg-gray-50">
                    <button onClick={() => removeMdo(mdo.id)} className="text-red-500 hover:text-red-700 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <hr className="border-gray-200" />
      
       {/* Mapping Matrix */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Replication Scope (Matrix)</h3>
        <p className="text-sm text-gray-500 mb-4">Select which master data objects are replicated to which target system.</p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider bg-gray-100 sticky left-0 z-10 border-b border-gray-200">
                  MDO \ Target
                </th>
                {targets.map(t => (
                  <th key={t.id} className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-gray-200">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mdos.map(mdo => (
                <tr key={mdo.id}>
                  <td className="px-4 py-3 font-medium text-sm text-gray-900 bg-gray-50 sticky left-0 border-r border-gray-100">
                    {mdo.name}
                  </td>
                  {targets.map(t => {
                    const isActive = mappings.find(m => m.mdoId === mdo.id && m.targetId === t.id)?.active || false;
                    return (
                      <td key={`${mdo.id}-${t.id}`} className="px-4 py-3 text-center bg-white">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleMapping(mdo.id, t.id)}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};