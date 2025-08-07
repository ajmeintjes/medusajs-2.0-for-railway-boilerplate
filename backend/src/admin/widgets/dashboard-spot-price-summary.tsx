import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useState, useEffect } from "react"

type SpotPrice = {
  symbol: string
  metal_type: string
  price: number
  currency: string
  change_percentage_24h?: number
  last_updated: string
}

// Compact dashboard widget for spot prices
const DashboardSpotPriceSummary = () => {
  const [prices, setPrices] = useState<Record<string, SpotPrice | null>>({})
  const [loading, setLoading] = useState(true)

  const fetchPrices = async () => {
    try {
      const response = await fetch('/admin/spot-prices', {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setPrices(result.current_prices)
      }
    } catch (err) {
      // Silently fail for dashboard widget
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()
    // Refresh every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const activePrices = Object.entries(prices)
    .filter(([_, price]) => price !== null)
    .map(([metalType, price]) => ({ metalType, ...price! }))

  // Don't show widget if no data and not loading
  if (!loading && activePrices.length === 0) {
    return <></>
  }

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h3">Spot Prices</Heading>
        </div>
        <div className="px-6 py-4">
          <Text className="text-ui-fg-muted text-sm">Loading prices...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h3">Live Spot Prices</Heading>
        <Text className="text-xs text-ui-fg-muted">
          {activePrices.length > 0 && new Date(activePrices[0].last_updated).toLocaleTimeString()}
        </Text>
      </div>
      <div className="px-6 py-4">
        <div className="flex flex-wrap gap-4">
          {activePrices.slice(0, 3).map((price) => (
            <div key={price.symbol} className="flex items-center gap-2">
              <Badge variant="grey" size="small">
                {price.symbol}
              </Badge>
              <Text className="font-semibold text-sm">
                {formatPrice(price.price)}
              </Text>
              {price.change_percentage_24h !== undefined && (
                <Badge 
                  variant={price.change_percentage_24h >= 0 ? 'green' : 'red'} 
                  size="small"
                >
                  {price.change_percentage_24h >= 0 ? '+' : ''}
                  {price.change_percentage_24h.toFixed(1)}%
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

// Widget configuration - show on main dashboard
export const config = defineWidgetConfig({
  zone: ["order.list.before", "product.list.before"],
})

export default DashboardSpotPriceSummary
