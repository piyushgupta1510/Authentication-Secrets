require("dotenv").config();
const express = require ("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
//const encrypt = require("mongoose-encryption");
//const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate= require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended:true}));

app.use(session({
  secret:"Out little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser:true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

//userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]}) ;
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res)=>{
  res.render("home");
});

app.get("/register", (req,res)=>{
  res.render("register");
});

app.get("/secrets", (req, res)=>{
  User.find({"secret": {$ne:null}}, (err, foundUsers)=>{
    if(err)
    console.log(err);
    else{
      if(req.isAuthenticated())
      res.render("secrets", {usersWithSecret: foundUsers});
      else
      res.redirect("login");
    }

  });
  // if(req.isAuthenticated())
  // res.render("secrets");
  // else
  // res.redirect("/login");
});

app.post("/register", (req, res)=>{

// bcrypt.hash(req.body.password,saltRounds, (err, hash)=>{
//   const user = new User({
//     email: req.body.username,
//     password: hash
//   });
//   user.save((err)=>{
//     if(!err)
//     res.render("secrets");
//     else
//     console.log(err);
//   });
// });
// Working with passport
User.register({username:req.body.username}, req.body.password, (err, user)=>{
  if(err){
    console.log(err);
    res.redirect("/register");
  }
  else{
    passport.authenticate("local")(req, res, ()=>{
      res.redirect("/secrets");
    })
  }

})

})

app.get("/login", (req,res)=>{
  res.render("login");
});

app.post("/login", (req,res)=>{
  // const username = req.body.username;
  // const password = req.body.password;
  // User.findOne({email:username}, (err, foundUser)=>{
  //   if(!err){
  //     if(foundUser){
  //       bcrypt.compare(password, foundUser.password, (err, result)=>{
  //         if(result)
  //         res.render("secrets");
  //       })
  //
  //     }
  //     else
  //     console.log("Username or Password not correct");
  //   }
  //   else
  //   console.log(err);
  // })
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, (err)=>{
    if(err)
    console.log(err);
    else
    passport.authenticate("local")(req, res, ()=>{
      res.redirect("/secrets");
    })
  })
});

app.get("/logout", (req, res)=>{
  req.logout();
  res.redirect("/");
});

app.get("/submit", (req,res)=>{
  if(req.isAuthenticated())
  res.render("submit");
  else
  res.redirect("/login");
});

app.post("/submit", (req,res)=>{
  const secret = req.body.secret;
  User.findById(req.user.id, (err,foundUser)=>{
    if(!err){
      if(foundUser)
      {
        foundUser.secret= secret;
        foundUser.save(()=>{
          res.redirect("/secrets");
        });
      }
    }
    else{
      console.log(err);
    }
  });
  console.log(req.user);
});

// google Login
app.get("/auth/google",
  passport.authenticate("google", {scope:["profile"]})
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  (req, res)=> {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });




app.listen(3000, ()=>{console.log("Server Started at port 3000");});
