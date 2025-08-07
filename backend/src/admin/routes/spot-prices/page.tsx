import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { 
  Container, 
  Heading, 
  Text, 
  Badge, 
  Button,
  Input,
  Select,
  Label,
  Table,
  StatusBadge
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { Eye } from "@medusajs/icons"

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

type Statistics = {
  total_entries: number
  metals_tracked: number
  last_update: string | null
  data_sources: Record<string, number>
}

type AdminSpotPricesResponse = {
  current_prices: Record<string, SpotPrice | null>
  statistics: Statistics
}

type ApiKey = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  status: string
  expires_at?: string
  last_used_at?: string
  usage_count: number
  created_at: string
  notes?: string
}

type ApiKeyCreateResponse = {
  api_key: ApiKey
  token: string
  message: string
}

const SpotPricesPage = () => {
  const [data, setData] = useState<AdminSpotPricesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form state for manual price entry
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    metal_type: 'XAU',
    price_per_ounce: '',
    currency: 'USD',
    bid_price: '',
    ask_price: ''
  })
  const [submitting, setSubmitting] = useState(false)

  // API Key management state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [keyFormData, setKeyFormData] = useState({
    name: '',
    scopes: ['read'],
    expires_at: '',
    notes: '',
    key_format: 'standard' // standard, custom, jwt-like
  })
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<{[key: string]: boolean}>({})
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null)

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(`/admin/spot-prices/api-keys`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setApiKeys(result.api_keys || [])
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    }
  }

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingKey(true)

    try {
      const payload = {
        name: keyFormData.name,
        scopes: keyFormData.scopes,
        expires_at: keyFormData.expires_at || undefined,
        notes: keyFormData.notes || undefined,
        key_format: keyFormData.key_format,
      }

      const response = await fetch(`/admin/spot-prices/api-keys`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create API key')
      }

      const result: ApiKeyCreateResponse = await response.json()
      setNewKeyToken(result.token)
      setShowToken(true)
      setKeyFormData({ name: '', scopes: ['read'], expires_at: '', notes: '', key_format: 'standard' })
      setShowCreateKey(false)
      await fetchApiKeys()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setCreatingKey(false)
    }
  }

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/admin/spot-prices/api-keys/${keyId}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'revoke' }),
      })

      if (response.ok) {
        await fetchApiKeys()
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err)
    }
  }

  const handleRegenerateApiKey = async (keyId: string) => {
    setRegeneratingKey(keyId)
    try {
      const response = await fetch(`/admin/spot-prices/api-keys/${keyId}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate' }),
      })

      if (response.ok) {
        const result = await response.json()
        setNewKeyToken(result.token)
        setShowToken(true)
        await fetchApiKeys()
      }
    } catch (err) {
      console.error('Failed to regenerate API key:', err)
    } finally {
      setRegeneratingKey(null)
    }
  }

  const copyToClipboard = async (text: string, keyId?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      if (keyId) {
        setCopyFeedback(prev => ({ ...prev, [keyId]: true }))
        setTimeout(() => {
          setCopyFeedback(prev => ({ ...prev, [keyId]: false }))
        }, 2000)
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        if (keyId) {
          setCopyFeedback(prev => ({ ...prev, [keyId]: true }))
          setTimeout(() => {
            setCopyFeedback(prev => ({ ...prev, [keyId]: false }))
          }, 2000)
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/admin/spot-prices`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPrice = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const payload = {
        metal_type: formData.metal_type,
        price_per_ounce: parseFloat(formData.price_per_ounce),
        currency: formData.currency,
        ...(formData.bid_price && { bid_price: parseFloat(formData.bid_price) }),
        ...(formData.ask_price && { ask_price: parseFloat(formData.ask_price) }),
      }

      const response = await fetch(`/admin/spot-prices`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create spot price')
      }

      // Reset form and refresh data
      setFormData({
        metal_type: 'XAU',
        price_per_ounce: '',
        currency: 'USD',
        bid_price: '',
        ask_price: ''
      })
      setShowAddForm(false)
      await fetchData()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit price')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchApiKeys()
  }, [])

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return 'N/A'
    
    const isPositive = change >= 0
    const color = isPositive ? 'text-green-600' : 'text-red-600'
    const sign = isPositive ? '+' : ''
    
    return (
      <span className={color}>
        {sign}{change.toFixed(2)}
      </span>
    )
  }

  const getSourceBadgeVariant = (source?: string) => {
    switch (source) {
      case 'api_primary': return 'green'
      case 'api_backup': return 'orange'  
      case 'manual': return 'blue'
      default: return 'grey'
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <div className="mb-6">
          <Heading level="h1">Spot Price Management</Heading>
          <Text className="text-ui-fg-muted">Loading...</Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-8">
        <div className="mb-6">
          <Heading level="h1">Spot Price Management</Heading>
          <Text className="text-red-600">Error: {error}</Text>
          <Button variant="secondary" size="small" onClick={fetchData} className="mt-2">
            Retry
          </Button>
        </div>
      </Container>
    )
  }

  const activePrices = Object.entries(data?.current_prices || {})
    .filter(([_, price]) => price !== null)
    .map(([metalType, price]) => ({ metalType, ...price! }))

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Spot Price Management</Heading>
          <Text className="text-ui-fg-muted">
            Manage and monitor precious metal spot prices
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData}>
            Refresh Data
          </Button>
          <Button 
            variant="primary" 
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Manual Price'}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {data?.statistics && (
        <Container className="p-6">
          <Heading level="h3" className="mb-4">Statistics</Heading>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <Text className="text-sm text-ui-fg-muted">Total Entries</Text>
              <Text className="text-2xl font-semibold">{data.statistics.total_entries}</Text>
            </div>
            <div>
              <Text className="text-sm text-ui-fg-muted">Metals Tracked</Text>
              <Text className="text-2xl font-semibold">{data.statistics.metals_tracked}</Text>
            </div>
            <div>
              <Text className="text-sm text-ui-fg-muted">Last Update</Text>
              <Text className="text-sm">
                {data.statistics.last_update 
                  ? new Date(data.statistics.last_update).toLocaleString()
                  : 'Never'
                }
              </Text>
            </div>
            <div>
              <Text className="text-sm text-ui-fg-muted">Data Sources</Text>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(data.statistics.data_sources).map(([source, count]) => (
                  <Badge key={source} color={getSourceBadgeVariant(source)} size="small">
                    {source}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Container>
      )}

      {/* Manual Price Entry Form */}
      {showAddForm && (
        <Container className="p-6">
          <Heading level="h3" className="mb-4">Add Manual Price</Heading>
          <form onSubmit={handleSubmitPrice} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metal_type">Metal Type</Label>
                <Select 
                  value={formData.metal_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, metal_type: value }))}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="XAU">Gold (XAU)</Select.Item>
                    <Select.Item value="XAG">Silver (XAG)</Select.Item>
                    <Select.Item value="XPT">Platinum (XPT)</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price_per_ounce">Price per Ounce *</Label>
                <Input
                  id="price_per_ounce"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_ounce}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_ounce: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="bid_price">Bid Price (Optional)</Label>
                <Input
                  id="bid_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bid_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, bid_price: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="ask_price">Ask Price (Optional)</Label>
                <Input
                  id="ask_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.ask_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, ask_price: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} isLoading={submitting}>
                {submitting ? 'Adding...' : 'Add Price'}
              </Button>
              <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Current Prices Table */}
      <Container className="p-0">
        <div className="px-6 py-4 border-b">
          <Heading level="h3">Current Active Prices</Heading>
        </div>
        
        {activePrices.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Text className="text-ui-fg-muted">No active spot prices available</Text>
            <Text className="text-sm text-ui-fg-muted mt-2">
              Add manual prices or ensure API integration is configured
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Metal</Table.HeaderCell>
                <Table.HeaderCell>Symbol</Table.HeaderCell>
                <Table.HeaderCell>Current Price</Table.HeaderCell>
                <Table.HeaderCell>24h Change</Table.HeaderCell>
                <Table.HeaderCell>24h %</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Last Updated</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {activePrices.map((price) => (
                <Table.Row key={price.symbol}>
                  <Table.Cell>
                    <Text className="font-medium capitalize">
                      {price.metalType.toLowerCase().replace('_', ' ')}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="grey">{price.symbol}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="font-semibold">
                      {formatPrice(price.price, price.currency)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {formatChange(price.change_24h)}
                  </Table.Cell>
                  <Table.Cell>
                    {price.change_percentage_24h ? (
                      <Badge 
                        color={price.change_percentage_24h >= 0 ? 'green' : 'red'}
                        size="small"
                      >
                        {price.change_percentage_24h >= 0 ? '+' : ''}
                        {price.change_percentage_24h.toFixed(2)}%
                      </Badge>
                    ) : (
                      <Text>N/A</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={getSourceBadgeVariant(price.source)}>
                      {price.source?.replace('_', ' ') || 'unknown'}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {new Date(price.last_updated).toLocaleString()}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      {/* API Key Management Section */}
      <Container className="p-0">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <Heading level="h3">API Key Management</Heading>
          <Button 
            variant="primary" 
            size="small"
            onClick={() => setShowCreateKey(!showCreateKey)}
          >
            {showCreateKey ? 'Cancel' : 'Generate API Key'}
          </Button>
        </div>

        {/* New API Key Token Display */}
        {newKeyToken && (
          <div className="px-6 py-4 bg-green-50 border-b">
            <div className="mb-2">
              <Text className="font-medium text-green-800">API Key Generated Successfully!</Text>
              <Text className="text-sm text-green-600">Save this key now - it won't be shown again.</Text>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={newKeyToken}
                readOnly
                className="font-mono"
              />
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <Eye /> : <Eye />}
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => copyToClipboard(newKeyToken)}
              >
                📋 Copy to Clipboard
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setNewKeyToken(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Create API Key Form */}
        {showCreateKey && (
          <div className="px-6 py-4 border-b bg-ui-bg-subtle">
            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="key_name">Key Name *</Label>
                  <Input
                    id="key_name"
                    placeholder="e.g., Production API, Development"
                    value={keyFormData.name}
                    onChange={(e) => setKeyFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="expires_at">Expires At (Optional)</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={keyFormData.expires_at}
                    onChange={(e) => setKeyFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                  />
                </div>
              </div>
              
                <div>
                  <Label htmlFor="key_format">Key Format</Label>
                  <Select 
                    value={keyFormData.key_format}
                    onValueChange={(value) => setKeyFormData(prev => ({ ...prev, key_format: value }))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="standard">Standard (64 chars hex)</Select.Item>
                      <Select.Item value="compact">Compact (32 chars)</Select.Item>
                      <Select.Item value="uuid">UUID Format</Select.Item>
                      <Select.Item value="jwt-like">JWT-like (prefix.payload.signature)</Select.Item>
                    </Select.Content>
                  </Select>
                  <Text className="text-xs text-ui-fg-muted mt-1">
                    Choose the format for your API key generation
                  </Text>
                </div>
                
                <div>
                  <Label htmlFor="scopes">Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {['read', 'write', 'admin', 'product_pricing'].map((scope) => (
                        <label key={scope} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={keyFormData.scopes.includes(scope)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setKeyFormData(prev => ({ 
                                  ...prev, 
                                  scopes: [...prev.scopes, scope] 
                                }))
                              } else {
                                setKeyFormData(prev => ({ 
                                  ...prev, 
                                  scopes: prev.scopes.filter(s => s !== scope) 
                                }))
                              }
                            }}
                          />
                          <Badge color={keyFormData.scopes.includes(scope) ? 'green' : 'grey'} size="small">
                            {scope.replace('_', ' ')}
                          </Badge>
                        </label>
                      ))}
                    </div>
                    <Text className="text-xs text-ui-fg-muted">
                      Select permissions for this API key. 'product_pricing' allows updating product prices.
                    </Text>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    placeholder="Description or notes about this API key"
                    value={keyFormData.notes}
                    onChange={(e) => setKeyFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={creatingKey} isLoading={creatingKey}>
                  {creatingKey ? 'Generating...' : 'Generate API Key'}
                </Button>
                <Button variant="secondary" onClick={() => setShowCreateKey(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* API Keys Table */}
        {apiKeys.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Text className="text-ui-fg-muted">No API keys found</Text>
            <Text className="text-sm text-ui-fg-muted mt-2">
              Generate an API key to integrate external spot price data sources
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Key</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Usage Count</Table.HeaderCell>
                <Table.HeaderCell>Last Used</Table.HeaderCell>
                <Table.HeaderCell>Expires</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {apiKeys.map((apiKey) => (
                <Table.Row key={apiKey.id}>
                  <Table.Cell>
                    <div>
                      <Text className="font-medium">{apiKey.name}</Text>
                      {apiKey.notes && (
                        <Text className="text-sm text-ui-fg-muted">{apiKey.notes}</Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Badge color="grey" className="font-mono">
                        {apiKey.key_prefix}...
                      </Badge>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() => copyToClipboard(apiKey.key_prefix + '...', apiKey.id)}
                        className="text-xs"
                      >
                        {copyFeedback[apiKey.id] ? '✅ Copied!' : '📋'}
                      </Button>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={apiKey.status === 'active' ? 'green' : 'red'}>
                      {apiKey.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{apiKey.usage_count.toLocaleString()}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {apiKey.last_used_at 
                        ? new Date(apiKey.last_used_at).toLocaleDateString()
                        : 'Never'
                      }
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {apiKey.expires_at 
                        ? new Date(apiKey.expires_at).toLocaleDateString()
                        : 'Never'
                      }
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      {apiKey.status === 'active' && (
                        <>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleRevokeApiKey(apiKey.id)}
                          >
                            Revoke
                          </Button>
                          <Button
                            variant="transparent"
                            size="small"
                            onClick={() => handleRegenerateApiKey(apiKey.id)}
                            isLoading={regeneratingKey === apiKey.id}
                          >
                            🔄 Regenerate
                          </Button>
                        </>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Spot Prices",
  icon: ChartBar,
})

export default SpotPricesPage
