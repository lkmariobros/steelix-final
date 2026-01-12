/**
 * tRPC Proxy Route
 * 
 * This proxies tRPC requests from the frontend to the backend server.
 * This solves cross-origin cookie issues on mobile browsers by making
 * all requests same-origin from the browser's perspective.
 */

// Use localhost for development, production URL for production
// Use 127.0.0.1 instead of localhost for better Windows compatibility
const getBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://steelix-final-production.up.railway.app'
  }
  // Use 127.0.0.1 for better Windows compatibility
  return 'http://127.0.0.1:8080'
}

const BACKEND_URL = getBackendUrl()

async function handler(request: Request) {
  const url = new URL(request.url)
  
  // Get the tRPC path (everything after /api/trpc/)
  const trpcPath = url.pathname.replace('/api/trpc/', '')
  const targetUrl = `${BACKEND_URL}/trpc/${trpcPath}${url.search}`
  
  // Forward all headers, especially cookies
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    // Skip host header as it will be set by fetch
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value)
    }
  })
  
  // Ensure cookies are forwarded
  const cookies = request.headers.get('cookie')
  if (cookies) {
    headers.set('cookie', cookies)
  }

  // Log for debugging
  console.log(`📡 tRPC proxy: ${request.method} ${trpcPath}`)
  console.log(`📡 Target URL: ${targetUrl}`)

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
      // Don't follow redirects - let client handle them
      redirect: 'manual',
    })

    // Create response with all headers from backend
    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      // Forward set-cookie headers to establish session
      responseHeaders.append(key, value)
    })

    // Add CORS headers for same-origin
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('tRPC proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error && 'cause' in error ? String(error.cause) : ''
    
    // Provide helpful error message if backend is not reachable
    if (errorMessage.includes('fetch failed') || errorMessage.includes('EACCES') || errorMessage.includes('ECONNREFUSED')) {
      return new Response(
        JSON.stringify({ 
          error: 'Backend server not reachable', 
          details: `Cannot connect to ${BACKEND_URL}. Please ensure the backend server is running on port 8080.`,
          hint: 'Run "cd apps/server && bun dev" to start the backend server. If the issue persists, check Windows Firewall settings.'
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: errorMessage, cause: errorDetails }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Handle all HTTP methods
export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

// Handle preflight requests
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  })
}

