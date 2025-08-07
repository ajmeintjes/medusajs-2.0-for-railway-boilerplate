import { 
  defineMiddlewares,
  authenticate,
} from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    // Admin routes - require authentication
    {
      matcher: "/admin/spot-prices*",
      middlewares: [
        authenticate(
          "user", 
          ["session", "bearer", "api-key"]
        ),
      ],
    },
  ],
})
