export interface BridgeLog {
  timestamp: string;
  text: string;
  type: 'stdout' | 'stderr' | 'system';
}

export interface Telemetry {
  cpu: number;
  memory: number;
  memoryUsedGB: string;
  memoryTotalGB: string;
  platform: string;
  uptimeSeconds: number;
  loadAvg: string[];
}

export interface ToolCallItem {
  id: string;
  tool: string;
  args?: Record<string, any>;
  timestamp: string;
  status: 'executing' | 'completed' | 'failed';
  duration?: number;
  output?: string;
}

export interface JarvisBridgeAPI {
  isElectron: boolean;
  startBridge: (options?: { voice?: boolean; sendMode?: 'audio' | 'text'; unlocked?: boolean }) => Promise<{ ok: boolean; pid?: number; error?: string }>;
  stopBridge: () => Promise<{ ok: boolean }>;
  getBridgeStatus: () => Promise<{ running: boolean; pid: number | null }>;
  executeCommand: (cmd: string) => Promise<{ code: number; output: string }>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
  onBridgeLog: (callback: (log: BridgeLog) => void) => () => void;
  onBridgeStatusChange: (callback: (status: { running: boolean; pid: number | null }) => void) => () => void;
  onTelemetry: (callback: (telemetry: Telemetry) => void) => () => void;
}

declare global {
  interface Window {
    jarvis?: JarvisBridgeAPI;
  }
}
