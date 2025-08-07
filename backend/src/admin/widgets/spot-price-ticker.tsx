import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, StatusBadge } from "@medusajs/ui"
import { useState, useEffect } from "react"

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

// The spot price ticker widget
const SpotPriceTicker = () => {
  const [prices, setPrices] = useState<Record<string, SpotPrice | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrices = async () => {
    try {
      setError(null)
      const response = await fetch('/admin/spot-prices', {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setPrices(result.current_prices)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const getChangeColor = (change?: number) => {
    if (!change) return 'grey'
    return change >= 0 ? 'green' : 'red'
  }

  // Don't show widget if there are no prices and it's not loading
  if (!loading && Object.values(prices).every(price => price === null)) {
    return <></> // Hide widget when no data available
  }

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h3">Spot Prices</Heading>
          <Text className="text-ui-fg-muted text-sm">Loading...</Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h3">Spot Prices</Heading>
          <StatusBadge color="red">Error</StatusBadge>
        </div>
        <div className="px-6 py-4">
          <Text className="text-sm text-red-600">{error}</Text>
        </div>
      </Container>
    )
  }

  const activePrices = Object.entries(prices)
    .filter(([_, price]) => price !== null)
    .map(([metalType, price]) => ({ metalType, ...price! }))

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h3">Live Spot Prices</Heading>
        <StatusBadge color="green">Live</StatusBadge>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activePrices.map((price) => (
            <div key={price.symbol} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="grey" size="small">{price.symbol}</Badge>
                  <Text className="font-medium text-sm">
                    {price.metalType.replace('XAU', 'Gold').replace('XAG', 'Silver').replace('XPT', 'Platinum')}
                  </Text>
                </div>
              </div>
              
              <div className="space-y-1">
                <Text className="text-lg font-semibold">
                  {formatPrice(price.price, price.currency)}
                </Text>
                
                {price.change_percentage_24h !== undefined && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={getChangeColor(price.change_percentage_24h)} 
                      size="small"
                    >
                      {price.change_percentage_24h >= 0 ? '+' : ''}
                      {price.change_percentage_24h.toFixed(2)}%
                    </Badge>
                    {price.change_24h && (
                      <Text className={`text-xs ${price.change_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {price.change_24h >= 0 ? '+' : ''}${Math.abs(price.change_24h).toFixed(2)}
                      </Text>
                    )}
                  </div>
                )}
              </div>
              
              <Text className="text-xs text-ui-fg-muted mt-2">
                {new Date(price.last_updated).toLocaleString()}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

// Widget configurations - inject into dashboard
export const config = defineWidgetConfig({
  zone: "order.details.before", // Show on order details page
})

export default SpotPriceTicker
