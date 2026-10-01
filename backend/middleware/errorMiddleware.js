export const notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

export const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'A file exceeds the configured file-size limit' });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.message || 'File upload failed' });
  if (err.code === 11000) return res.status(409).json({ message: 'A record with that unique value already exists' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(', ') });
  const status = res.statusCode >= 400 ? res.statusCode : 500;
  res.status(status).json({ message: err.message || 'Server error' });
};
