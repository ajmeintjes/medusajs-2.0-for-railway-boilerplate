import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Text, 
  Button,
  Badge,
  StatusBadge
} from "@medusajs/ui"
import { useState, useEffect } from "react"

type ConnectivityStatus = {
  primary: boolean
  backup: boolean
  errors: string[]
}

const SpotPricesSettingsPage = () => {
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(null)
  const [testing, setTesting] = useState(false)
  const [lastTest, setLastTest] = useState<Date | null>(null)

  const testApiConnectivity = async () => {
    setTesting(true)
    try {
      const response = await fetch('/admin/spot-prices/test-connectivity', {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setConnectivity(result)
        setLastTest(new Date())
      } else {
        setConnectivity({
          primary: false,
          backup: false,
          errors: ['Failed to test connectivity']
        })
      }
    } catch (error) {
      setConnectivity({
        primary: false,
        backup: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setTesting(false)
    }
  }

  const triggerManualUpdate = async () => {
    try {
      const response = await fetch('/admin/spot-prices/trigger-update', {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Show success message or refresh data
        alert('Manual price update triggered successfully!')
      } else {
        alert('Failed to trigger manual update')
      }
    } catch (error) {
      alert('Error triggering update: ' + error.message)
    }
  }

  const getStatusColor = (status: boolean) => {
    return status ? 'green' : 'red'
  }

  const getStatusText = (status: boolean) => {
    return status ? 'Connected' : 'Disconnected'
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <Heading level="h1">Spot Price Settings</Heading>
        <Text className="text-ui-fg-muted">
          Configure and monitor spot price API integrations
        </Text>
      </div>

      {/* API Connectivity Status */}
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h3">API Connectivity Status</Heading>
          <Button 
            variant="secondary" 
            onClick={testApiConnectivity}
            isLoading={testing}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>

        {connectivity ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Text className="font-medium">Primary API</Text>
                  <StatusBadge color={getStatusColor(connectivity.primary)}>
                    {getStatusText(connectivity.primary)}
                  </StatusBadge>
                </div>
                <Text className="text-sm text-ui-fg-muted">
                  Main data source for spot prices
                </Text>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Text className="font-medium">Backup API</Text>
                  <StatusBadge color={getStatusColor(connectivity.backup)}>
                    {getStatusText(connectivity.backup)}
                  </StatusBadge>
                </div>
                <Text className="text-sm text-ui-fg-muted">
                  Fallback data source
                </Text>
              </div>
            </div>

            {connectivity.errors.length > 0 && (
              <div className="mt-4">
                <Text className="font-medium text-red-600 mb-2">Connection Errors:</Text>
                <div className="space-y-1">
                  {connectivity.errors.map((error, index) => (
                    <Text key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </Text>
                  ))}
                </div>
              </div>
            )}

            {lastTest && (
              <Text className="text-xs text-ui-fg-muted">
                Last tested: {lastTest.toLocaleString()}
              </Text>
            )}
          </div>
        ) : (
          <Text className="text-ui-fg-muted">
            Click "Test Connection" to check API connectivity status
          </Text>
        )}
      </Container>

      {/* Configuration Information */}
      <Container className="p-6">
        <Heading level="h3" className="mb-4">Configuration</Heading>
        <div className="space-y-4">
          <div>
            <Text className="font-medium">Environment Variables Required:</Text>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-sm bg-ui-bg-subtle px-2 py-1 rounded">METALS_API_KEY</code>
                <Badge color={process.env.METALS_API_KEY ? 'green' : 'red'} size="small">
                  {process.env.METALS_API_KEY ? 'Set' : 'Missing'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-ui-bg-subtle px-2 py-1 rounded">METALS_API_URL</code>
                <Badge color="green" size="small">Optional</Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-ui-bg-subtle px-2 py-1 rounded">BACKUP_METALS_API_KEY</code>
                <Badge color={process.env.BACKUP_METALS_API_KEY ? 'green' : 'orange'} size="small">
                  {process.env.BACKUP_METALS_API_KEY ? 'Set' : 'Optional'}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <Text className="font-medium">Update Schedule:</Text>
            <Text className="text-sm text-ui-fg-muted mt-1">
              Automatic updates run every 5 minutes during configured hours
            </Text>
          </div>
        </div>
      </Container>

      {/* Manual Controls */}
      <Container className="p-6">
        <Heading level="h3" className="mb-4">Manual Controls</Heading>
        <div className="space-y-4">
          <div>
            <Text className="font-medium mb-2">Trigger Manual Price Update</Text>
            <Text className="text-sm text-ui-fg-muted mb-3">
              Immediately fetch latest prices from configured APIs
            </Text>
            <Button variant="secondary" onClick={triggerManualUpdate}>
              Trigger Update Now
            </Button>
          </div>
        </div>
      </Container>

      {/* Documentation */}
      <Container className="p-6">
        <Heading level="h3" className="mb-4">Documentation</Heading>
        <div className="space-y-3">
          <div>
            <Text className="font-medium">API Endpoints:</Text>
            <div className="mt-2 space-y-1 text-sm">
              <div><code>GET /admin/spot-prices</code> - View current prices and statistics</div>
              <div><code>POST /admin/spot-prices</code> - Add manual price entry</div>
              <div><code>GET /store/spot-prices</code> - Public endpoint for storefront</div>
            </div>
          </div>

          <div>
            <Text className="font-medium">Supported Metals:</Text>
            <div className="flex gap-2 mt-2">
              <Badge color="grey">XAU (Gold)</Badge>
              <Badge color="grey">XAG (Silver)</Badge>
              <Badge color="grey">XPT (Platinum)</Badge>
            </div>
          </div>

          <div>
            <Text className="font-medium">Data Sources:</Text>
            <div className="flex gap-2 mt-2">
              <Badge color="green">API Primary</Badge>
              <Badge color="orange">API Backup</Badge>
              <Badge color="blue">Manual Entry</Badge>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Spot Prices",
})

export default SpotPricesSettingsPage
