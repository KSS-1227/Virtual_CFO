import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EnhancedDocumentProcessor from './EnhancedDocumentProcessor';
import { enhancedDocumentAPI, documentUtils } from '@/services/enhancedDocumentAPI';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';

interface DocumentStats {
  total: number;
  processed: number;
  revenue_extracted: number;
  expenses_extracted: number;
  net_amount: number;
  by_type: Record<string, number>;
}

interface RecentDocument {
  id: string;
  file_name: string;
  doc_type: string;
  extracted_data: any;
  created_at: string;
  status: string;
}

const ProfessionalFinancialDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsResult, documentsResult] = await Promise.all([
        enhancedDocumentAPI.getDocumentStats(),
        enhancedDocumentAPI.getDocuments({ limit: 10, status: 'processed' })
      ]);

      if (statsResult.success) {
        setDocumentStats(statsResult.data);
      }

      if (documentsResult.success) {
        setRecentDocuments(documentsResult.data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Calculate financial insights
  const getFinancialInsights = () => {
    if (!documentStats) return null;

    const profitMargin = documentStats.revenue_extracted > 0 
      ? ((documentStats.net_amount / documentStats.revenue_extracted) * 100).toFixed(1)
      : '0';

    const expenseRatio = documentStats.revenue_extracted > 0
      ? ((documentStats.expenses_extracted / documentStats.revenue_extracted) * 100).toFixed(1)
      : '0';

    return {
      profitMargin: parseFloat(profitMargin),
      expenseRatio: parseFloat(expenseRatio),
      isProfit: documentStats.net_amount > 0,
      totalTransactions: documentStats.total
    };
  };

  const insights = getFinancialInsights();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Loading financial dashboard...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Professional CFO Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered document processing and financial analytics
          </p>
        </div>
        <Button onClick={refreshData} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Financial Overview Cards */}
      {documentStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-800">
                    {documentUtils.formatCurrency(documentStats.revenue_extracted)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-800">
                    {documentUtils.formatCurrency(documentStats.expenses_extracted)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-r ${
            insights?.isProfit 
              ? 'from-blue-50 to-blue-100 border-blue-200' 
              : 'from-orange-50 to-orange-100 border-orange-200'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    insights?.isProfit ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    Net Amount
                  </p>
                  <p className={`text-2xl font-bold ${
                    insights?.isProfit ? 'text-blue-800' : 'text-orange-800'
                  }`}>
                    {documentUtils.formatCurrency(documentStats.net_amount)}
                  </p>
                </div>
                <DollarSign className={`h-8 w-8 ${
                  insights?.isProfit ? 'text-blue-600' : 'text-orange-600'
                }`} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Documents Processed</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {documentStats.processed}
                  </p>
                  <p className="text-xs text-purple-600">
                    of {documentStats.total} total
                  </p>
                </div>
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className={`text-3xl font-bold ${
                  insights.profitMargin > 20 ? 'text-green-600' :
                  insights.profitMargin > 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {insights.profitMargin}%
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {insights.profitMargin > 20 ? 'Excellent' :
                   insights.profitMargin > 10 ? 'Good' : 'Needs Improvement'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Expense Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className={`text-3xl font-bold ${
                  insights.expenseRatio < 60 ? 'text-green-600' :
                  insights.expenseRatio < 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {insights.expenseRatio}%
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  of revenue
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Processing Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {documentStats ? Math.round((documentStats.processed / Math.max(documentStats.total, 1)) * 100) : 0}%
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  documents processed
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="recent">Recent Documents</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Document Types</CardTitle>
                <CardDescription>Breakdown by document category</CardDescription>
              </CardHeader>
              <CardContent>
                {documentStats?.by_type && Object.keys(documentStats.by_type).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(documentStats.by_type).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{documentUtils.getDocumentTypeIcon(type)}</span>
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No documents processed yet</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => setActiveTab('upload')} 
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Documents
                </Button>
                <Button 
                  onClick={() => setActiveTab('recent')} 
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Recent Processing
                </Button>
                <Button 
                  onClick={() => setActiveTab('analytics')} 
                  className="w-full justify-start"
                  variant="outline"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
                <Button 
                  onClick={refreshData} 
                  className="w-full justify-start"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <EnhancedDocumentProcessor />
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Latest processed financial documents</CardDescription>
            </CardHeader>
            <CardContent>
              {recentDocuments.length > 0 ? (
                <div className="space-y-4">
                  {recentDocuments.map((doc) => {
                    const extractedData = typeof doc.extracted_data === 'string' 
                      ? JSON.parse(doc.extracted_data) 
                      : doc.extracted_data;
                    
                    return (
                      <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{documentUtils.getDocumentTypeIcon(doc.doc_type)}</span>
                              <h4 className="font-medium">{doc.file_name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {doc.doc_type}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Revenue</p>
                                <p className="font-medium text-green-600">
                                  {documentUtils.formatCurrency(extractedData?.total_revenue || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Expenses</p>
                                <p className="font-medium text-red-600">
                                  {documentUtils.formatCurrency(extractedData?.total_expenses || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Net</p>
                                <p className={`font-medium ${
                                  (extractedData?.net_amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {documentUtils.formatCurrency(extractedData?.net_amount || 0)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {documentUtils.formatDate(doc.created_at)}
                            </p>
                            <Badge 
                              variant={doc.status === 'processed' ? 'default' : 'secondary'}
                              className="mt-1"
                            >
                              {doc.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No documents processed yet</p>
                  <Button 
                    onClick={() => setActiveTab('upload')} 
                    className="mt-4"
                    variant="outline"
                  >
                    Upload Your First Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              <strong>Advanced Analytics:</strong> Comprehensive financial insights and trends 
              based on your processed documents. More analytics features coming soon.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfessionalFinancialDashboard;