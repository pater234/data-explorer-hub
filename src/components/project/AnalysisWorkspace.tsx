import { useState, useEffect, useRef } from 'react';
import { PreviewResponse, sendChatMessage, ChatMessage, migrateFiles, analyzeFiles } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Loader2, Database, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisWorkspaceProps {
  preview: PreviewResponse;
  fileIds: string[];
  projectId: string;
  onBack: () => void;
  onMigrationComplete: (result: any) => void;
}

export function AnalysisWorkspace({
  preview,
  fileIds,
  projectId,
  onBack,
  onMigrationComplete
}: AnalysisWorkspaceProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposedDdl, setProposedDdl] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build initial context about the data
  const buildDataContext = () => {
    const fileInfo = Object.entries(preview.file_previews).map(([name, rows]) => {
      const headers = rows[0] || '';
      const sampleRows = rows.slice(1, 4).join('\n');
      return `**${name}**\nColumns: ${headers}\nSample data:\n${sampleRows}`;
    }).join('\n\n');

    return fileInfo;
  };

  // Send initial greeting when component mounts
  useEffect(() => {
    const dataContext = buildDataContext();
    const fileCount = Object.keys(preview.file_previews).length;
    const fileNames = Object.keys(preview.file_previews).join(', ');

    const initialMessage: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: `I've loaded **${fileCount} file(s)**: ${fileNames}

I can see the following data structure:

${dataContext}

Let me help you design a database schema for this data.

**A few questions to get started:**
1. What is this data used for?
2. Are there any relationships between these tables (e.g., do they share common IDs)?
3. Are there any columns that should NOT be imported or that need special handling?

Feel free to ask me anything about your data or tell me how you'd like it structured!`,
      timestamp: new Date().toISOString(),
    };

    setMessages([initialMessage]);
  }, []);

  // Call Gemini to analyze and generate schema
  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);
    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: 'Please analyze my data and generate a database schema.',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await analyzeFiles(fileIds);
      if (result.success && result.proposed_ddl) {
        setProposedDdl(result.proposed_ddl);
        const assistantMessage: ChatMessage = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Here's the proposed schema based on your data:\n\n\`\`\`sql\n${result.proposed_ddl}\n\`\`\`\n\nWould you like me to make any changes? Or click **"Migrate Now"** to create these tables and import your data.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        toast({
          title: 'Analysis Failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build context with data info and proposed DDL if available
      const dataContext = buildDataContext();
      const ddlContext = proposedDdl
        ? `\n\nCurrent proposed schema:\n\`\`\`sql\n${proposedDdl}\n\`\`\``
        : '';

      const systemContext = `You are helping design a database schema. Here's the data:\n\n${dataContext}${ddlContext}`;

      const response = await sendChatMessage({
        projectId,
        message: `${systemContext}\n\nUser question: ${inputValue}`,
        context: {
          schema: null,
          metrics: null,
          conversationHistory: messages.slice(-10),
        },
      });

      const assistantMessage: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSchema = async () => {
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: 'Please generate the PostgreSQL DDL schema based on our conversation.',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const dataContext = buildDataContext();
      const conversationSummary = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');

      const response = await sendChatMessage({
        projectId,
        message: `Based on our conversation, generate PostgreSQL CREATE TABLE statements.

Data context:
${dataContext}

Conversation so far:
${conversationSummary}

Requirements:
- Use appropriate data types (VARCHAR, TEXT, INTEGER, DECIMAL, DATE, etc.)
- Add PRIMARY KEY constraints
- Add FOREIGN KEY constraints if relationships were discussed
- Wrap column names in double quotes to preserve exact names
- Output ONLY the SQL DDL, no explanations`,
        context: {
          schema: null,
          metrics: null,
          conversationHistory: messages.slice(-10),
        },
      });

      // Extract DDL from response (look for SQL code block or just use the response)
      let ddl = response.message;
      const sqlMatch = ddl.match(/```sql\n?([\s\S]*?)```/);
      if (sqlMatch) {
        ddl = sqlMatch[1];
      }
      setProposedDdl(ddl);

      const assistantMessage: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Here's the proposed schema:\n\n\`\`\`sql\n${ddl}\n\`\`\`\n\nWould you like me to make any changes? Or click **"Migrate Now"** to create these tables and import your data.`,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate schema',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!proposedDdl) {
      toast({
        title: 'No schema',
        description: 'Please generate a schema first',
        variant: 'destructive',
      });
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateFiles(fileIds, proposedDdl);
      onMigrationComplete(result);
      toast({
        title: 'Migration Complete!',
        description: `Created ${result.tables_created.length} tables`,
      });
    } catch (error) {
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Files
        </Button>
        <div className="flex gap-2">
          {!proposedDdl && (
            <Button
              onClick={handleAnalyzeWithAI}
              disabled={isLoading || isMigrating || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleGenerateSchema}
            disabled={isLoading || isMigrating || isAnalyzing}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Schema
          </Button>
          {proposedDdl && (
            <Button
              onClick={handleMigrate}
              disabled={isMigrating}
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Migrate Now
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Data Preview */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <Tabs defaultValue={Object.keys(preview.file_previews)[0]} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2 flex-wrap h-auto">
                {Object.keys(preview.file_previews).map((filename) => (
                  <TabsTrigger key={filename} value={filename} className="text-xs">
                    {filename}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(preview.file_contents).map(([filename, content]) => {
                const rows = content.split('\n').slice(0, 50); // Show first 50 rows
                return (
                  <TabsContent key={filename} value={filename} className="flex-1 overflow-auto m-0 p-4">
                    <div className="overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          {rows.map((row, i) => {
                            const cells = row.split(',');
                            return (
                              <tr key={i} className={i === 0 ? 'bg-muted font-semibold sticky top-0' : 'border-b'}>
                                {cells.map((cell, j) => (
                                  <td key={j} className="px-2 py-1 border-r whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {content.split('\n').length > 50 && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Showing first 50 of {content.split('\n').length} rows
                        </p>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Right: Chat */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Schema Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                        {message.content.split('```').map((part, i) => {
                          if (i % 2 === 1) {
                            // Code block
                            const lines = part.split('\n');
                            const lang = lines[0];
                            const code = lines.slice(1).join('\n');
                            return (
                              <pre key={i} className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-auto">
                                <code>{code || part}</code>
                              </pre>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about your data or describe relationships..."
                  disabled={isLoading || isMigrating}
                />
                <Button type="submit" size="icon" disabled={isLoading || isMigrating || !inputValue.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
