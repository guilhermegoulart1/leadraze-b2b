// backend/src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Return Google profile
    return done(null, {
      id: profile.id,
      email: profile.emails[0].value,
      displayName: profile.displayName,
      photos: profile.photos
    });
  }));

  console.log('✅ Google OAuth configured');
} else {
  console.log('⚠️ Google OAuth not configured (missing credentials)');
}

module.exports = passport;