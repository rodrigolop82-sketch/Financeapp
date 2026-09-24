// Límites compartidos entre cliente y servidor para la importación multi-foto.
export const MAX_IMPORT_IMAGES = 10

// Tamaño máximo por imagen ya comprimida (por debajo del límite de body de Vercel, ~4.5 MB).
export const MAX_COMPRESSED_IMAGE_BYTES = 3 * 1024 * 1024

// Peticiones simultáneas a /api/extract-statement durante un lote.
export const IMPORT_CONCURRENCY = 3

// Ventana en la que un batchId sigue aceptando fotos (evita reutilizarlo para saltarse el límite).
export const BATCH_WINDOW_MINUTES = 30

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
