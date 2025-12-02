const passport = require("passport");
const gooleStrategy = require("passport-google-oauth20");
const User = require("../models/userSchema");
const env = require("dotenv").config();

passport.use(
  new gooleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      callbackURL: "http://localhost:3000/google/callback",
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if(user.isBlocked){
          return done(null, false, {message : "User is blocked by Admin"}) 
        }
        if (user) {
          return done(null, user);
        } else {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          await user.save();
          return done(null, user);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// To assign user details to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

//To fetch user details from session
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

module.exports = passport;
