import { z } from "zod"
import { MetalType } from "../../../modules/spot-price"

export const CreateSpotPriceSchema = z.object({
  metal_type: z.nativeEnum(MetalType).refine(
    (val) => Object.values(MetalType).includes(val),
    {
      message: "metal_type must be one of: XAU, XAG, XPT",
    }
  ),
  price_per_ounce: z.number().positive({
    message: "price_per_ounce must be a positive number"
  }),
  currency: z.string().length(3).optional(),
  bid_price: z.number().positive().optional(),
  ask_price: z.number().positive().optional(),
})

export const GetPriceHistorySchema = z.object({
  metal_type: z.nativeEnum(MetalType).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
})
