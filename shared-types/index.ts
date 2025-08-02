// Common types that can be shared between Medusa and Payload CMS

export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'user'
  createdAt: Date
  updatedAt: Date
}

export interface Media {
  id: string
  url: string
  filename: string
  mimeType: string
  filesize: number
  width?: number
  height?: number
  alt?: string
  createdAt: Date
  updatedAt: Date
}

// Add more shared types as needed
