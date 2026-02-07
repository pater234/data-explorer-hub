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
  metrics: DataMetrics;
  schema: SchemaData;
}

// Gemini-extracted metrics
export interface DataMetrics {
  totalRecords: number;
  tableCount: number;
  completenessScore: number;
  confirmedJoins: number;
  suggestedJoins: number;
  uniqueEntities: { name: string; count: number }[];
  dateRange?: { start: string; end: string };
}

// Schema visualization data
export interface SchemaData {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}

export interface SchemaNode {
  id: string;
  tableName: string;
  source: string;
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface SchemaEdge {
  id: string;
  source: { table: string; column: string };
  target: { table: string; column: string };
  confidence: number;
  joinType: 'inner' | 'left' | 'right' | 'full';
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

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  projectId: string;
  message: string;
  context: {
    schema: SchemaData | null;
    metrics: DataMetrics | null;
    conversationHistory: ChatMessage[];
  };
}

export interface ChatResponse {
  message: string;
  sources?: string[];
}

// localStorage key for projects
const PROJECTS_STORAGE_KEY = 'migration_projects';

// Load projects from localStorage or use defaults
function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to defaults
  }
  return [];
}

// Save projects to localStorage
function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

// API Functions
export async function getProjects(): Promise<Project[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return loadProjects();
}

export async function getProject(id: string): Promise<Project | null> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const projects = loadProjects();
  return projects.find(p => p.id === id) || null;
}

export async function createProject(name: string, description?: string): Promise<Project> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const projects = loadProjects();
  const newProject: Project = {
    id: String(Date.now()),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    connectedSources: [],
  };
  projects.unshift(newProject);
  saveProjects(projects);
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
    metrics: {
      totalRecords: 2000,
      tableCount: 2,
      completenessScore: 94,
      confirmedJoins: 1,
      suggestedJoins: 0,
      uniqueEntities: [
        { name: 'Customers', count: 420 },
        { name: 'Orders', count: 1500 },
        { name: 'Regions', count: 8 },
      ],
      dateRange: { start: '2024-10-01', end: '2024-12-31' },
    },
    schema: {
      nodes: [
        {
          id: 'sales',
          tableName: 'Sales_Q4_2024',
          source: 'Sales_Q4_2024.xlsx',
          columns: [
            { name: 'order_id', type: 'string', isPrimaryKey: true },
            { name: 'customer_id', type: 'string', isForeignKey: true },
            { name: 'amount', type: 'number' },
            { name: 'date', type: 'date' },
          ],
        },
        {
          id: 'customers',
          tableName: 'Customer_Data',
          source: 'Customer_Data.xlsx',
          columns: [
            { name: 'customer_id', type: 'string', isPrimaryKey: true },
            { name: 'name', type: 'string' },
            { name: 'segment', type: 'string' },
            { name: 'region', type: 'string' },
          ],
        },
      ],
      edges: [
        {
          id: 'sales-customers',
          source: { table: 'sales', column: 'customer_id' },
          target: { table: 'customers', column: 'customer_id' },
          confidence: 0.95,
          joinType: 'inner',
        },
      ],
    },
  };
}

// Preview types (download files without AI)
export interface PreviewResponse {
  success: boolean;
  file_contents: Record<string, string>;
  file_previews: Record<string, string[]>;
  logs: string[];
  error?: string;
}

// Analysis types
export interface AnalyzeResponse {
  success: boolean;
  proposed_ddl: string;
  file_previews: Record<string, string[]>;
  logs: string[];
  error?: string;
}

/**
 * Preview files - download and return contents WITHOUT calling Gemini
 * Backend endpoint: POST /api/preview
 */
export async function previewFiles(fileIds: string[]): Promise<PreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_ids: fileIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Preview failed' }));
    throw new Error(error.detail || 'Preview failed');
  }

  return response.json();
}

/**
 * Analyze files and get proposed schema (without creating tables)
 * Backend endpoint: POST /api/analyze
 * If fileContents is provided, uses that directly (no re-download needed)
 */
export async function analyzeFiles(fileIds: string[], fileContents?: Record<string, string>): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_ids: fileIds,
      file_contents: fileContents || {},
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Analysis failed' }));
    throw new Error(error.detail || 'Analysis failed');
  }

  return response.json();
}

// Migration types
export interface MigrateRequest {
  file_ids: string[];
  custom_ddl?: string;
  database_name?: string;
}

export interface MigrateResponse {
  success: boolean;
  tables_created: string[];
  rows_inserted: Record<string, number>;
  ddl: string;
  errors: string[];
  logs: string[];
}

/**
 * Migrate selected files to Postgres database
 * Backend endpoint: POST /api/migrate
 * If fileContents is provided, uses that directly (no re-download needed)
 */
export async function migrateFiles(fileIds: string[], customDdl?: string, fileContents?: Record<string, string>): Promise<MigrateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_ids: fileIds,
      file_contents: fileContents || {},
      custom_ddl: customDdl || '',
      database_name: 'migrated_data',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Migration failed' }));
    throw new Error(error.detail || 'Migration failed');
  }

  return response.json();
}

/**
 * Send a chat message to the Gemini-powered assistant
 * Backend endpoint: POST /api/chat
 */
// Query types
export interface QueryResponse {
  success: boolean;
  columns: string[];
  rows: any[][];
  row_count: number;
  error?: string;
}

export interface TableInfo {
  name: string;
  row_count: number;
}

/**
 * Execute a SQL query
 */
export async function executeQuery(sql: string): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  return response.json();
}

/**
 * List all tables in the database
 */
export async function listTables(): Promise<TableInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/tables`);
  const data = await response.json();
  return data.tables || [];
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  // Try to call real backend first
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Fall back to mock response
  }

  // Mock response for development
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  
  const { message, context } = request;
  const lowerMessage = message.toLowerCase();
  
  // Generate contextual mock responses
  if (lowerMessage.includes('table') || lowerMessage.includes('available')) {
    const tableNames = context.schema?.nodes.map(n => n.tableName).join(', ') || 'Sales_Q4_2024, Customer_Data';
    return {
      message: `Based on my analysis, you have ${context.metrics?.tableCount || 2} tables available:\n\n• **${tableNames.split(', ').join('**\n• **')}**\n\nThese tables contain a total of ${context.metrics?.totalRecords?.toLocaleString() || '2,000'} records. Would you like me to explain the structure of any specific table?`,
    };
  }
  
  if (lowerMessage.includes('relat') || lowerMessage.includes('join') || lowerMessage.includes('connect')) {
    return {
      message: `I've identified a relationship between your tables:\n\n**Sales_Q4_2024.customer_id** → **Customer_Data.customer_id**\n\nThis is a high-confidence join (95%) that links each sale to its corresponding customer record. This allows you to analyze sales by customer segment, region, and other customer attributes.`,
    };
  }
  
  if (lowerMessage.includes('quality') || lowerMessage.includes('complete')) {
    const score = context.metrics?.completenessScore || 94;
    return {
      message: `Your data quality looks good! Here's the summary:\n\n• **Completeness Score**: ${score}%\n• **Missing Values**: Very few null values detected\n• **Unique Entities**: ${context.metrics?.uniqueEntities?.length || 3} distinct entity types identified\n\nThe main areas with some missing data are customer_id fields in the sales table (5 records).`,
    };
  }
  
  if (lowerMessage.includes('insight') || lowerMessage.includes('summar') || lowerMessage.includes('key')) {
    return {
      message: `Here are the key insights from your data:\n\n1. **Volume**: ${context.metrics?.totalRecords?.toLocaleString() || '2,000'} total records across ${context.metrics?.tableCount || 2} tables\n\n2. **Time Range**: Data spans from ${context.metrics?.dateRange?.start || 'Q4 2024'} to ${context.metrics?.dateRange?.end || 'end of 2024'}\n\n3. **Customers**: ${context.metrics?.uniqueEntities?.find(e => e.name === 'Customers')?.count || 420} unique customers identified\n\n4. **Data Integrity**: Strong relationship between sales and customer data with 95% join confidence\n\nWould you like me to dive deeper into any of these areas?`,
    };
  }
  
  // Default response
  return {
    message: `I understand you're asking about "${message}". Based on my analysis of your data structure, I can help you explore:\n\n• Table structures and column types\n• Relationships between tables\n• Data quality metrics\n• Key insights and patterns\n\nCould you be more specific about what you'd like to know?`,
  };
}
