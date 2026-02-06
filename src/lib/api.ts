import { API_BASE_URL } from './config';
import { ComposioProvider } from './composio';

// Placeholder API calls - these will connect to real backend endpoints

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
  connectedSources: CloudSource[];
}

export interface CloudSource {
  id: string;
  type: 'google-drive' | 'onedrive';
  name: string;
  email: string;
  connected: boolean;
  connectedAt?: string;
}

export interface SpreadsheetFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
  source: 'google-drive' | 'onedrive';
  path?: string;
}

export interface AgentStatus {
  stage: 'idle' | 'scanning' | 'analyzing' | 'inferring' | 'complete' | 'error';
  message: string;
  progress?: number;
  details?: string;
}

export interface JoinProposal {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  joinType: 'inner' | 'left' | 'right' | 'full';
}

export interface AnalysisResult {
  tables: TableSchema[];
  joinProposals: JoinProposal[];
  insights: string[];
}

export interface TableSchema {
  id: string;
  name: string;
  source: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[];
}

// Mock data for development
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Q4 Sales Analysis',
    description: 'Analyzing quarterly sales data across regions',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    status: 'active',
    connectedSources: [],
  },
  {
    id: '2',
    name: 'Customer Segmentation',
    description: 'Customer data analysis for marketing',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T12:00:00Z',
    status: 'active',
    connectedSources: [],
  },
];

// API Functions
export async function getProjects(): Promise<Project[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockProjects;
}

export async function getProject(id: string): Promise<Project | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockProjects.find(p => p.id === id) || null;
}

export async function createProject(name: string, description?: string): Promise<Project> {
  await new Promise(resolve => setTimeout(resolve, 400));
  const newProject: Project = {
    id: String(Date.now()),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    connectedSources: [],
  };
  mockProjects.push(newProject);
  return newProject;
}

export async function connectCloudSource(
  projectId: string,
  type: 'google-drive' | 'onedrive'
): Promise<CloudSource> {
  await new Promise(resolve => setTimeout(resolve, 800));
  // In real implementation, this would trigger OAuth flow
  return {
    id: String(Date.now()),
    type,
    name: type === 'google-drive' ? 'Google Drive' : 'OneDrive',
    email: 'user@example.com',
    connected: true,
    connectedAt: new Date().toISOString(),
  };
}

export async function getSpreadsheets(provider: ComposioProvider): Promise<SpreadsheetFile[]> {
  // In production, this calls the backend which uses Composio to fetch real files
  try {
    const response = await fetch(`${API_BASE_URL}/api/spreadsheets?provider=${provider}`);
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Fall back to mock data if backend is unavailable
  }
  
  // Mock spreadsheet files for development
  await new Promise(resolve => setTimeout(resolve, 600));
  return [
    {
      id: '1',
      name: 'Sales_Q4_2024.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      modifiedTime: '2024-01-20T10:00:00Z',
      size: 245000,
      source: provider,
      path: '/Reports/Sales',
    },
    {
      id: '2',
      name: 'Customer_Data.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      modifiedTime: '2024-01-19T14:30:00Z',
      size: 512000,
      source: provider,
      path: '/Data',
    },
    {
      id: '3',
      name: 'Product_Catalog.csv',
      mimeType: 'text/csv',
      modifiedTime: '2024-01-18T09:00:00Z',
      size: 89000,
      source: provider,
      path: '/Inventory',
    },
    {
      id: '4',
      name: 'Regional_Metrics.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      modifiedTime: '2024-01-17T16:45:00Z',
      size: 178000,
      source: provider,
      path: '/Reports/Regional',
    },
  ];
}

export async function submitFilesForAnalysis(
  projectId: string,
  fileIds: string[]
): Promise<{ jobId: string }> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { jobId: String(Date.now()) };
}

export async function getAnalysisStatus(jobId: string): Promise<AgentStatus> {
  await new Promise(resolve => setTimeout(resolve, 200));
  // This would poll the backend for status
  return {
    stage: 'analyzing',
    message: 'Analyzing spreadsheet structure...',
    progress: 45,
  };
}

export async function getAnalysisResults(jobId: string): Promise<AnalysisResult> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    tables: [
      {
        id: '1',
        name: 'Sales_Q4_2024',
        source: 'Sales_Q4_2024.xlsx',
        columns: [
          { name: 'order_id', type: 'string', nullCount: 0, uniqueCount: 1500, sampleValues: ['ORD-001', 'ORD-002'] },
          { name: 'customer_id', type: 'string', nullCount: 5, uniqueCount: 420, sampleValues: ['CUST-100', 'CUST-101'] },
          { name: 'amount', type: 'number', nullCount: 0, uniqueCount: 890, sampleValues: ['150.00', '299.99'] },
          { name: 'date', type: 'date', nullCount: 0, uniqueCount: 92, sampleValues: ['2024-10-01', '2024-10-02'] },
        ],
        rowCount: 1500,
      },
      {
        id: '2',
        name: 'Customer_Data',
        source: 'Customer_Data.xlsx',
        columns: [
          { name: 'customer_id', type: 'string', nullCount: 0, uniqueCount: 500, sampleValues: ['CUST-100', 'CUST-101'] },
          { name: 'name', type: 'string', nullCount: 2, uniqueCount: 498, sampleValues: ['Acme Corp', 'Beta Inc'] },
          { name: 'segment', type: 'string', nullCount: 0, uniqueCount: 4, sampleValues: ['Enterprise', 'SMB'] },
          { name: 'region', type: 'string', nullCount: 0, uniqueCount: 8, sampleValues: ['North', 'South'] },
        ],
        rowCount: 500,
      },
    ],
    joinProposals: [
      {
        id: '1',
        sourceTable: 'Sales_Q4_2024',
        sourceColumn: 'customer_id',
        targetTable: 'Customer_Data',
        targetColumn: 'customer_id',
        confidence: 0.95,
        joinType: 'inner',
      },
    ],
    insights: [
      'Found 1500 sales records spanning Q4 2024',
      '420 unique customers identified across sales data',
      'High confidence join available between Sales and Customer tables',
      'Customer segmentation data available for all matched records',
    ],
  };
}
