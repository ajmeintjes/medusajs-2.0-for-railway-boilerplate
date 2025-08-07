import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Text, 
  Button,
  Badge,
  StatusBadge,
  Select,
  Input,
  Label,
  Table,
  Alert
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { CloudArrowDown, ExclamationCircle, CheckCircle } from "@medusajs/icons"

type ImportSource = 'primary' | 'backup' | 'manual'

type ImportResult = {
  success: boolean
  metal_type: string
  price: number
  source: string
  timestamp: string
  error?: string
}

type ApiConnectivity = {
  primary: boolean
  backup: boolean
  errors: string[]
}

type SpotPrice = {
  symbol: string
  metal_type: string
  price: number
  currency: string
  change_24h?: number
  change_percentage_24h?: number
  last_updated: string
  source?: string
}

// Spot Price Import Widget
const SpotPriceImportWidget = () => {
  const [importing, setImporting] = useState(false)
  const [connectivity, setConnectivity] = useState<ApiConnectivity | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [selectedSource, setSelectedSource] = useState<ImportSource>('primary')
  const [selectedMetals, setSelectedMetals] = useState<string[]>(['XAU', 'XAG', 'XPT'])
  const [lastImport, setLastImport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPrices, setCurrentPrices] = useState<Record<string, SpotPrice | null>>({})

  // Manual import settings
  const [manualImportData, setManualImportData] = useState({
    primaryApiKey: '',
    primaryApiUrl: 'https://api.metals-api.com/v1',
    backupApiKey: '',
    backupApiUrl: '',
    requestTimeout: 10000
  })

  const fetchCurrentPrices = async () => {
    try {
      const response = await fetch('/admin/spot-prices', {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setCurrentPrices(result.current_prices)
      }
    } catch (err) {
      console.error('Failed to fetch current prices:', err)
    }
  }

  const testApiConnectivity = async () => {
    setTestingConnection(true)
    setError(null)

    try {
      const response = await fetch('/admin/spot-prices/api/test-connectivity', {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(manualImportData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setConnectivity(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connectivity')
      setConnectivity(null)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleImportPrices = async () => {
    setImporting(true)
    setError(null)
    setImportResults([])

    try {
      const payload = {
        source: selectedSource,
        metals: selectedMetals,
        ...(selectedSource !== 'primary' && manualImportData),
      }

      const response = await fetch('/admin/spot-prices/import', {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Import failed')
      }

      const result = await response.json()
      setImportResults(result.results || [])
      setLastImport(new Date().toISOString())
      
      // Refresh current prices
      await fetchCurrentPrices()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleBulkImport = async () => {
    setImporting(true)
    setError(null)

    try {
      const response = await fetch('/admin/spot-prices/bulk-import', {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sources: ['primary', 'backup'],
          metals: selectedMetals,
        }),
      })

      if (!response.ok) {
        throw new Error('Bulk import failed')
      }

      const result = await response.json()
      setImportResults(result.results || [])
      setLastImport(new Date().toISOString())
      await fetchCurrentPrices()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    fetchCurrentPrices()
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'primary': return 'green'
      case 'backup': return 'orange'
      case 'manual': return 'blue'
      default: return 'grey'
    }
  }

  const activeMetals = Object.entries(currentPrices)
    .filter(([_, price]) => price !== null)
    .map(([metalType, price]) => ({ metalType, ...price! }))

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <CloudArrowDown className="w-5 h-5 text-ui-fg-subtle" />
          <Heading level="h3">Spot Price Import</Heading>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="small"
            onClick={testApiConnectivity}
            isLoading={testingConnection}
          >
            Test Connection
          </Button>
          <Button 
            variant="primary" 
            size="small"
            onClick={handleBulkImport}
            isLoading={importing}
          >
            Bulk Import
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-4">
          <Alert variant="error">
            <ExclamationCircle className="w-4 h-4" />
            <Text className="text-sm">{error}</Text>
          </Alert>
        </div>
      )}

      {/* API Connectivity Status */}
      {connectivity && (
        <div className="px-6 py-4 bg-ui-bg-subtle">
          <div className="flex items-center gap-4">
            <Text className="font-medium text-sm">API Status:</Text>
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge color={connectivity.primary ? 'green' : 'red'}>
                  Primary API
                </StatusBadge>
                {connectivity.primary && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge color={connectivity.backup ? 'green' : 'red'}>
                  Backup API
                </StatusBadge>
                {connectivity.backup && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
            </div>
          </div>
          {connectivity.errors.length > 0 && (
            <div className="mt-2">
              <Text className="text-xs text-ui-fg-muted">Errors:</Text>
              {connectivity.errors.map((error, idx) => (
                <Text key={idx} className="text-xs text-red-600">{error}</Text>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current Prices Summary */}
      {activeMetals.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <Text className="font-medium text-sm">Current Spot Prices</Text>
            {lastImport && (
              <Text className="text-xs text-ui-fg-muted">
                Last Import: {new Date(lastImport).toLocaleString()}
              </Text>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {activeMetals.map((price) => (
              <div key={price.symbol} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="grey" size="small">{price.symbol}</Badge>
                  <Badge variant={getSourceBadgeColor(price.source || 'unknown')} size="small">
                    {price.source?.replace('_', ' ') || 'unknown'}
                  </Badge>
                </div>
                <Text className="text-lg font-semibold">{formatPrice(price.price)}</Text>
                {price.change_percentage_24h !== undefined && (
                  <Text className={`text-xs ${price.change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {price.change_percentage_24h >= 0 ? '+' : ''}
                    {price.change_percentage_24h.toFixed(2)}%
                  </Text>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Configuration */}
      <div className="px-6 py-4">
        <Heading level="h4" className="mb-4">Import Configuration</Heading>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="import_source">Import Source</Label>
            <Select 
              value={selectedSource}
              onValueChange={(value) => setSelectedSource(value as ImportSource)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="primary">Primary API</Select.Item>
                <Select.Item value="backup">Backup API</Select.Item>
                <Select.Item value="manual">Manual Configuration</Select.Item>
              </Select.Content>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="metals">Metals to Import</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['XAU', 'XAG', 'XPT'].map((metal) => (
                <label key={metal} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMetals.includes(metal)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMetals(prev => [...prev, metal])
                      } else {
                        setSelectedMetals(prev => prev.filter(m => m !== metal))
                      }
                    }}
                  />
                  <Badge variant={selectedMetals.includes(metal) ? 'green' : 'grey'} size="small">
                    {metal}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Manual Configuration */}
        {selectedSource === 'manual' && (
          <div className="border rounded-lg p-4 mb-4 bg-ui-bg-subtle">
            <Text className="font-medium text-sm mb-3">API Configuration</Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_api_key">Primary API Key</Label>
                <Input
                  id="primary_api_key"
                  type="password"
                  placeholder="Enter primary API key"
                  value={manualImportData.primaryApiKey}
                  onChange={(e) => setManualImportData(prev => ({ ...prev, primaryApiKey: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="primary_api_url">Primary API URL</Label>
                <Input
                  id="primary_api_url"
                  placeholder="https://api.metals-api.com/v1"
                  value={manualImportData.primaryApiUrl}
                  onChange={(e) => setManualImportData(prev => ({ ...prev, primaryApiUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="backup_api_key">Backup API Key (Optional)</Label>
                <Input
                  id="backup_api_key"
                  type="password"
                  placeholder="Enter backup API key"
                  value={manualImportData.backupApiKey}
                  onChange={(e) => setManualImportData(prev => ({ ...prev, backupApiKey: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="backup_api_url">Backup API URL</Label>
                <Input
                  id="backup_api_url"
                  placeholder="https://backup-api.example.com"
                  value={manualImportData.backupApiUrl}
                  onChange={(e) => setManualImportData(prev => ({ ...prev, backupApiUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="primary" 
            onClick={handleImportPrices}
            isLoading={importing}
            disabled={selectedMetals.length === 0}
          >
            {importing ? 'Importing...' : 'Import Prices'}
          </Button>
          <Button variant="secondary" onClick={fetchCurrentPrices}>
            Refresh Current Prices
          </Button>
        </div>
      </div>

      {/* Import Results */}
      {importResults.length > 0 && (
        <div className="px-6 py-4">
          <Heading level="h4" className="mb-4">Import Results</Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Metal</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Price</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Timestamp</Table.HeaderCell>
                <Table.HeaderCell>Error</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {importResults.map((result, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell>
                    <Badge variant="grey" size="small">{result.metal_type}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={result.success ? 'green' : 'red'}>
                      {result.success ? 'Success' : 'Failed'}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    {result.success ? formatPrice(result.price) : 'N/A'}
                  </Table.Cell>
                  <Table.Cell>
                    {result.success && (
                      <Badge variant={getSourceBadgeColor(result.source)} size="small">
                        {result.source}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {result.success ? new Date(result.timestamp).toLocaleString() : 'N/A'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {result.error && (
                      <Text className="text-xs text-red-600">{result.error}</Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

// Widget configuration - inject into the admin extensions -> spot prices area
export const config = defineWidgetConfig({
  zone: "product.list.before", // Show on product list page for easy access during product management
})

export default SpotPriceImportWidget
