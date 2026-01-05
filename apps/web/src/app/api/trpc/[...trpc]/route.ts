/**
 * tRPC Proxy Route
 * 
 * This proxies tRPC requests from the frontend to the backend server.
 * This solves cross-origin cookie issues on mobile browsers by making
 * all requests same-origin from the browser's perspective.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://steelix-final-production.up.railway.app'

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
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' }),
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

