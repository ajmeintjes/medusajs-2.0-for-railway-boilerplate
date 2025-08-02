<p align="center">
  <a href="https://www.medusajs.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
      <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg" width=100>
    </picture>
  </a>
  <a href="https://railway.app/template/gkU-27?referralCode=-Yg50p">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://railway.app/brand/logo-light.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://railway.app/brand/logo-dark.svg">
      <img alt="Railway logo" src="https://railway.app/brand/logo-light.svg" width=100>
    </picture>
  </a>
  <a href="https://payloadcms.com">
    <picture>
      <img alt="Payload CMS logo" src="https://raw.githubusercontent.com/payloadcms/payload/main/src/admin/assets/images/payload-logo-light.svg" width=100>
    </picture>
  </a>
</p>

<h2 align="center">
  Medusa.js 2.0 + Payload CMS v3 Boilerplate
</h2>
<h4 align="center">
  E-commerce Backend + Headless CMS + Storefront + PostgreSQL + Redis + MinIO + MeiliSearch
</h4>

<h2 align="center">
  <a href="https://railway.app/template/gkU-27?referralCode=-Yg50p">one-click deploy on railway!</a>
</h2>

<h1 align="center">
  Need help?<br>
  <a href="https://funkyton.com/medusajs-2-0-is-finally-here/">Step by step deploy guide, and video instructions</a>
</h1>

<p align="center">
Combine Medusa's modules for your commerce backend with the newest Next.js 14 features for a performant storefront.</p>

## About this boilerplate
This boilerplate is a monorepo combining MedusaJS 2.0 e-commerce backend with Payload CMS v3 for content management. It's a pre-configured, ready-to-deploy solution for building modern e-commerce applications with a powerful content management system.

### Key Features

- **Medusa.js 2.8.8** - Headless e-commerce platform
- **Payload CMS v3** - Self-hosted, TypeScript-first headless CMS
- **Next.js Storefront** - Modern React-based storefront
- **Shared Database** - Single PostgreSQL database with separate schemas
- **TypeScript** - Full TypeScript support across all components
- **Monorepo** - Unified development experience

Updated: `Medusa v2.8.8` + `Payload CMS v3.49.1` 🚀

## Preconfigured Integrations

### Medusa.js
- MinIO file storage: Cloud storage with automatic bucket creation [README](backend/src/modules/minio-file/README.md)
- Resend email integration [Setup Guide](backend/src/modules/email-notifications/README.md)
- Stripe payment service
- MeiliSearch integration for product search

### Payload CMS
- PostgreSQL database with separate schema
- Authentication & Authorization
- Media library with image optimization
- GraphQL and REST APIs
- Custom collections and globals

# Getting Started

## Prerequisites

- Node.js 18+
- PostgreSQL 13+
- pnpm
- Redis (optional, for caching)

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ajmeintjes/medusajs-2.0-for-railway-boilerplate.git
   cd medusajs-2.0-for-railway-boilerplate
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   pnpm install
   
   # Install backend dependencies
   cd backend
   pnpm install
   
   # Install CMS dependencies
   cd ../cms
   pnpm install
   
   # Install storefront dependencies
   cd ../storefront
   pnpm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env` in both `backend` and `cms` directories
   - Update the database connection strings and other required variables

4. **Start the development servers**
   ```bash
   # From the root directory
   pnpm dev
   ```

   This will start:
   - Medusa backend on http://localhost:9000
   - Payload CMS on http://localhost:3000
   - Storefront on http://localhost:8000

## Payload CMS Setup

1. **Initialize the database schema**
   ```bash
   cd cms
   pnpm db:create-schema
   pnpm db:init
   ```

2. **Access the admin panel**
   - Visit http://localhost:3000/admin
   - Log in with the default credentials (set in your .env file)

## Documentation

- [Medusa.js Documentation](https://docs.medusajs.com/)
- [Payload CMS Documentation](https://payloadcms.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

# Project Structure

## /backend

### local setup
Video instructions: https://youtu.be/PPxenu7IjGM

- `cd /backend`
- `pnpm install` or `npm i`
- Rename `.env.template` ->  `.env`
- To connect to your online database from your local machine, copy the `DATABASE_URL` value auto-generated on Railway and add it to your `.env` file.
  - If connecting to a new database, for example a local one, run `pnpm ib` or `npm run ib` to seed the database.
- `pnpm dev` or `npm run dev`

### requirements
- **postgres database** (Automatic setup when using the Railway template)
- **redis** (Automatic setup when using the Railway template) - fallback to simulated redis.
- **MinIO storage** (Automatic setup when using the Railway template) - fallback to local storage.
- **Meilisearch** (Automatic setup when using the Railway template)

### commands

`cd backend/`
`npm run ib` or `pnpm ib` will initialize the backend by running migrations and seed the database with required system data.
`npm run dev` or `pnpm dev` will start the backend (and admin dashboard frontend on `localhost:9000/app`) in development mode.
`pnpm build && pnpm start` will compile the project and run from compiled source. This can be useful for reproducing issues on your cloud instance.

# /storefront

### local setup
Video instructions: https://youtu.be/PPxenu7IjGM

Install dependencies `npm i` of `pnpm i`
Rename `.env.local.template` ->  `.env.local`

### requirements
- A running backend on port 9000 is required to fetch product data and other information needed to build Next.js pages.

### commands
`cd storefront/`
`npm run dev` or `pnpm dev` will run the storefront on uncompiled code, with hot-reloading as files are saved with changes.

## Useful resources
- How to setup credit card payment with Stripe payment module: https://youtu.be/dcSOpIzc1Og
- https://funkyton.com/medusajs-2-0-is-finally-here/#succuessfully-deployed-whats-next
  
<p align="center">
  <a href="https://funkyton.com/">
    <div style="text-align: center;">
      A template by,
      <br>
      <picture>
        <img alt="FUNKYTON logo" src="https://res-5.cloudinary.com/hczpmiapo/image/upload/q_auto/v1/ghost-blog-images/funkyton-logo.png" width=200>
      </picture>
    </div>
  </a>
</p>
