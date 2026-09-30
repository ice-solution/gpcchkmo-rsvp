function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/admin/login?next=${nextUrl}`);
}

function attachAdminLocals(req, res, next) {
  res.locals.admin = req.session?.admin || null;
  res.locals.query = req.query;
  next();
}

module.exports = {
  requireAdmin,
  attachAdminLocals,
};
