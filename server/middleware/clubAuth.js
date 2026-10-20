function requireClub(req, res, next) {
  if (req.session && req.session.club) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || '/club');
  return res.redirect(`/club/login?next=${nextUrl}`);
}

function attachClubLocals(req, res, next) {
  res.locals.clubUser = req.session?.club || null;
  next();
}

module.exports = {
  requireClub,
  attachClubLocals,
};
