import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { PreviewResponse, analyzeFiles, migrateFiles, sendChatMessage, ChatMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Database, Sparkles, Edit3, Eye, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SchemaViewer } from './SchemaViewer';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposedDdl, setProposedDdl] = useState<string | null>(null);
  const [editedDdl, setEditedDdl] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build context for chat
  const buildDataContext = () => {
    const fileInfo = Object.entries(preview.file_previews).map(([name, rows]) => {
      const headers = rows[0] || '';
      const sampleRows = rows.slice(1, 3).join('\n');
      return `**${name}**\nColumns: ${headers}\nSample: ${sampleRows}`;
    }).join('\n\n');
    return fileInfo;
  };

  // Call Gemini to analyze and generate schema
  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);

    try {
      const result = await analyzeFiles(fileIds, preview.file_contents);
      if (result.success && result.proposed_ddl) {
        setProposedDdl(result.proposed_ddl);
        setEditedDdl(result.proposed_ddl);

        // Add initial assistant message
        const initialMessage: ChatMessage = {
          id: String(Date.now()),
          role: 'assistant',
          content: `I've analyzed your data and generated a schema with **${result.proposed_ddl.match(/CREATE TABLE/gi)?.length || 0} tables**.

Please review the proposed schema above. If anything doesn't look right or you have questions, let me know! For example:
- "Why did you choose VARCHAR for the price column?"
- "Can you change the customer_id to be a foreign key?"
- "What relationships did you find between the tables?"

When you're happy with the schema, click **"Migrate Now"** to create the tables.`,
          timestamp: new Date().toISOString(),
        };
        setMessages([initialMessage]);

        toast({
          title: 'Schema Generated',
          description: 'Review the proposed schema and migrate when ready.',
        });
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

  // Send chat message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsChatLoading(true);

    try {
      const dataContext = buildDataContext();
      const schemaContext = editedDdl ? `\n\nCurrent schema:\n\`\`\`sql\n${editedDdl}\n\`\`\`` : '';

      const response = await sendChatMessage({
        projectId,
        message: `Context about the data:\n${dataContext}${schemaContext}\n\nUser question: ${inputValue}`,
        context: {
          schema: null,
          metrics: null,
          conversationHistory: messages.slice(-5),
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
      setIsChatLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!editedDdl) {
      toast({
        title: 'No schema',
        description: 'Please generate a schema first',
        variant: 'destructive',
      });
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateFiles(fileIds, editedDdl, preview.file_contents);
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
              disabled={isAnalyzing}
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
          {proposedDdl && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    View Schema
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit SQL
                  </>
                )}
              </Button>
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
            </>
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

        {/* Right: Schema */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              {proposedDdl ? 'Proposed Schema' : 'Schema'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {!proposedDdl ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No schema yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Analyze with AI" to generate a database schema from your data
                </p>
                <Button onClick={handleAnalyzeWithAI} disabled={isAnalyzing}>
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
              </div>
            ) : isEditing ? (
              <Textarea
                value={editedDdl}
                onChange={(e) => setEditedDdl(e.target.value)}
                className="font-mono text-xs h-full min-h-[500px] resize-none"
              />
            ) : (
              <SchemaViewer ddl={editedDdl} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Section */}
      {proposedDdl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Schema Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <div className="max-h-[200px] overflow-auto space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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
                placeholder="Ask about the schema or request changes..."
                disabled={isChatLoading}
              />
              <Button type="submit" size="icon" disabled={isChatLoading || !inputValue.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
