/**
 * Auth Proxy Route
 * 
 * This proxies Better Auth requests from the frontend to the backend server.
 * This solves cross-origin cookie issues on mobile browsers by making
 * all requests same-origin from the browser's perspective.
 * 
 * The backend sets cookies, and this proxy forwards them to the client
 * as first-party cookies (same domain), which mobile browsers accept.
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
  
  // Get the auth path (everything after /api/auth/)
  const authPath = url.pathname.replace('/api/auth/', '')
  const targetUrl = `${BACKEND_URL}/api/auth/${authPath}${url.search}`
  
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
  console.log(`🔐 Auth proxy: ${request.method} ${authPath}`)
  console.log(`🔐 Target URL: ${targetUrl}`)
  console.log(`🔐 BACKEND_URL: ${BACKEND_URL}`)

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
      redirect: 'manual',
    })

    // Create response with all headers from backend
    const responseHeaders = new Headers()
    
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      
      // Handle Set-Cookie specially - need to modify for same-origin
      if (lowerKey === 'set-cookie') {
        // Parse and modify the cookie to work as first-party
        let modifiedCookie = value
        
        // Remove SameSite=None since we're now same-origin
        modifiedCookie = modifiedCookie.replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
        
        // Remove domain restriction if present (let it default to current domain)
        modifiedCookie = modifiedCookie.replace(/;\s*Domain=[^;]+/gi, '')
        
        responseHeaders.append('Set-Cookie', modifiedCookie)
      } else {
        responseHeaders.set(key, value)
      }
    })

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')

    console.log(`🔐 Auth proxy response: ${response.status}`)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Auth proxy error:', error)
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

