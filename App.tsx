import React, { useState } from 'react';
import { Settings, BarChart3, Calculator, BookOpen, GitGraph } from 'lucide-react';
import { ConfigForm } from './components/ConfigForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { FormulaReference } from './components/FormulaReference';
import { SimulatorDiagram } from './components/SimulatorDiagram';
import { MasterDataObject, TargetSystem, Mapping, GlobalConfig, MiddlewareCluster } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'config' | 'dashboard' | 'simulator' | 'formulas'>('config');

  // Initial State Defaults
  const [mdos, setMdos] = useState<MasterDataObject[]>([
    { id: '1', name: 'Customer Master', volume: 500000, packetSize: 100, payloadSizePerRecordKB: 1.5 },
    { id: '2', name: 'Material Master', volume: 1200000, packetSize: 200, payloadSizePerRecordKB: 2.0 },
    { id: '3', name: 'Vendor Master', volume: 50000, packetSize: 50, payloadSizePerRecordKB: 1.2 },
  ]);

  const [clusters, setClusters] = useState<MiddlewareCluster[]>([
    { id: 'c1', name: 'MuleSoft US Region', maxThreads: 50, maxQueues: 10, maxQueueCapacityMB: 5000 },
    { id: 'c2', name: 'SAP CPI EU Region', maxThreads: 20, maxQueues: 5, maxQueueCapacityMB: 2000 },
  ]);

  const [targets, setTargets] = useState<TargetSystem[]>([
    { id: 't1', middlewareClusterId: 'c1', name: 'SAP S/4HANA (US)', apiRateLimitRPM: 3000, replicationType: 'Realtime', middlewareRateLimitEnabled: false, middlewareIngressRPM: 30 },
    { id: 't2', middlewareClusterId: 'c1', name: 'Salesforce CRM', apiRateLimitRPM: 1000, replicationType: 'Scheduled', scheduleIntervalMinutes: 15, middlewareRateLimitEnabled: false, middlewareIngressRPM: 30 },
    { id: 't3', middlewareClusterId: 'c2', name: 'Legacy ERP', apiRateLimitRPM: 300, replicationType: 'Realtime', middlewareRateLimitEnabled: false, middlewareIngressRPM: 30 },
  ]);

  const [mappings, setMappings] = useState<Mapping[]>([
    { mdoId: '1', targetId: 't1', active: true },
    { mdoId: '1', targetId: 't2', active: true },
    { mdoId: '2', targetId: 't1', active: true },
    { mdoId: '2', targetId: 't3', active: true },
    { mdoId: '3', targetId: 't1', active: true },
  ]);

  const [config, setConfig] = useState<GlobalConfig>({
    avgMiddlewareResponseTimeMs: 200,
    mdgConcurrency: 4,
    integrationPattern: 'ASYNC',
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Master Data Replication through Middleware Planner</h1>
                <p className="text-xs text-gray-500">API Load & Queue Estimator</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" /> Configuration
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Results & Dashboard
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <GitGraph className="w-4 h-4" /> Simulator View
          </button>
          <button
            onClick={() => setActiveTab('formulas')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'formulas'
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Logic & Formulas
          </button>
        </div>

        {/* Content Area */}
        <div className="transition-all duration-300 ease-in-out">
          {activeTab === 'config' && (
            <ConfigForm
              mdos={mdos} setMdos={setMdos}
              targets={targets} setTargets={setTargets}
              clusters={clusters} setClusters={setClusters}
              mappings={mappings} setMappings={setMappings}
              config={config} setConfig={setConfig}
            />
          )}
          {activeTab === 'dashboard' && (
            <ResultsDashboard
              mdos={mdos}
              targets={targets}
              clusters={clusters}
              mappings={mappings}
              config={config}
            />
          )}
          {activeTab === 'simulator' && (
             <SimulatorDiagram 
               mdos={mdos}
               targets={targets}
               clusters={clusters}
               mappings={mappings}
               config={config}
             />
          )}
          {activeTab === 'formulas' && (
            <FormulaReference />
          )}
        </div>

      </main>
    </div>
  );
}

export default App;