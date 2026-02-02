import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch before importing the module
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocking
const { fileServer } = await import('@/lib/api/file-server')

describe('FileServerClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fileServer.clearToken() // Reset auth state between tests
  })

  describe('health', () => {
    it('should call health endpoint', async () => {
      const mockResponse = { status: 'ok', timestamp: '2026-02-02T00:00:00Z', uptime: 1000 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fileServer.health()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('readFile', () => {
    it('should read file with encoded path', async () => {
      const mockContent = { content: 'hello', modifiedAt: '2026-02-02T00:00:00Z', size: 5 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockContent),
      })

      const result = await fileServer.readFile('/path/to/file.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files?path=%2Fpath%2Fto%2Ffile.txt'),
        expect.any(Object)
      )
      expect(result).toEqual(mockContent)
    })
  })

  describe('writeFile', () => {
    it('should write file with POST request', async () => {
      const mockResponse = { success: true, size: 5, modifiedAt: '2026-02-02T00:00:00Z' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fileServer.writeFile('/path/to/file.txt', 'hello')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: '/path/to/file.txt', content: 'hello' }),
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('listDirectory', () => {
    it('should list directory with encoded path', async () => {
      const mockResponse = { files: [], count: 0 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fileServer.listDirectory('/some/dir')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/list?dir=%2Fsome%2Fdir'),
        expect.any(Object)
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteFile', () => {
    it('should delete file with DELETE request', async () => {
      const mockResponse = { success: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await fileServer.deleteFile('/path/to/file.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files?path=%2Fpath%2Fto%2Ffile.txt'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      await expect(fileServer.health()).rejects.toThrow('Not found')
    })

    it('should handle json parse error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      // When json() fails, the error falls back to 'Unknown error'
      await expect(fileServer.health()).rejects.toThrow('Unknown error')
    })
  })

  describe('authentication', () => {
    it('should include auth token when set', async () => {
      fileServer.setToken('test-token')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: '', uptime: 0 }),
      })

      await fileServer.health()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      )
    })

    it('should work without auth token', async () => {
      // Create a fresh instance to test without token
      // The fileServer is a singleton, so we test the no-token path via health check
      // before any token is set in this describe block
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: '', uptime: 0 }),
      })

      await fileServer.health()

      // Should still have Content-Type header
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })
})
