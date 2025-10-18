// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    details: err?.message ?? 'Unknown error'
  });
};
