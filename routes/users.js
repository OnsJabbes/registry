const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');


// Load User model
const User = require('../models/User');

const { JsonWebTokenError } = require('jsonwebtoken');

router.use(express.json());

// Login Page
router.get('/login', (req, res) => res.render('login'));

// Register Page
router.get('/register', (req, res) => res.render('register'));

//mail sender details 
var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'onsjabes@gmail.com',
		pass: 'jgnrmcdpdpkcdgwm'
	},
	tls: {
		rejectUnauthorized: false
	}
})

// Register
router.post('/register', (req, res) => {
	const { name, email, password, password2 } = req.body;
	const characters = "0123456789";
	let activationCode = "";
	for (let i = 0; i < 4; i++) {
		activationCode += characters[Math.floor(Math.random() * characters.length)];
	}

	let errors = [];

	if (!name || !email || !password || !password2) {
		errors.push({ msg: 'Please enter all fields' });
	}

	if (password != password2) {
		errors.push({ msg: 'Passwords do not match' });
	}

	//if (password.length < 6) {
	//	errors.push({ msg: 'Passwords must be at least 6 characters' });
	//}

	if (errors.length > 0) {
		res.render('register', {
			errors,
			name,
			email,
			password,
			password2,

		});
	} else {
		User.findOne({ email: email }).then(user => {
			if (user) {
				errors.push({ msg: 'Email already exists' });
				res.render('register', {
					errors,
					name,
					email,
					password,
					password2,

				});
			} else {
				const newUser = new User({

					name,
					email,
					password,
					activationCode,
					isActive: false,
					expiresAt: Date.now() + 60000, //1 minute 

				})

				bcrypt.genSalt(10, (err, salt) => {
					bcrypt.hash(newUser.password, salt, (err, hash) => {
						if (err) throw err;
						newUser.password = hash;
						newUser
							.save()
							.then(user => {
								req.flash(
									'success_msg',
									'You are now registered check your mail for a verification code '
								);

								var mailoptions = {
									from: '"verify your email" <onsjabes@gmail.com>',
									to: email,
									subject: "Verification",
									html: `
          <div>
          <h1>lost and found  </h1>
            <h2>welcome ${name} ! </h2>
            <p>enter code <b> ${activationCode} </b> in the app to verify your email adress and complete verification </p>
            <p> this code <b> expires in 1 minute  </b> . <p>
            <a href="http://localhost:8000//users/verification">click here to insert your code</a>
            </div>`,
								}

								transporter.sendMail(mailoptions, function (err, info) {
									if (err) {
										console.log(err);
									}
									else {
										console.log('Verfication email is sent to your gmail account');
									}
								})

								res.redirect('/users/verification');
							})
							.catch(err => console.log(err));
					});
				});
			}
		});
	}
});

//verif  page 
router.get('/verification', (req, res) => res.render('verification'));


//verif 
router.post('/verification', async (req, res) => {
 try {
		const { email, code } = req.body;
		let errors = [];
      	console.log(email);


		const userverification = await User.find({
				email
			});
	if (userverification.length <= 0) {
			 
   
		const { expiresAt } = userverification[0];
		const { activationCode } = userverification[0];

	   console.log(activationCode);
	   console.log(code); 

		    if (expiresAt < Date.now()) {
			User.deleteMany({ email });
			errors.push({ msg:"expiered code retry registration"})	; 
			res.render('verification', {errors }) ;  		
			} else 

		   if (!activationCode == code) {
						
					errors.push({msg:"invalid code passed . check your email"})	
					res.render('verification', {errors }) ; } 
	}else {
						//success 
						await User.updateOne({ email }, { isActive: true });

						res.redirect('/users/login');
						return res.status(200).json({
							msg:"valid verification now you can log in"
						})	
    }

	} catch (error) {
		//error code verif
		res.json({
			status: "FAILED",
			message: 'erreur '
		});
	}
});

// Login Page
router.get('/login', (req, res) => res.render('login'));

// Login
router.post('/login', async (req, res) => {
	try{
		const { email , password } = req.body;
		const exist = await User.findOne({email});

		if(!exist){
			return res.status(404).json({
				msg:"user with the given email doesn't exist"
			})
		}else{
			if(exist.isActive == false){
				return res.status(401).json({
					msg:"user is not verified"
				})
			}

			const match = await bcrypt.compare(password , exist.password);

			if(match){
				return res.status(200).json({
					msg:"logged in successfully",
					token:generateToken({
						name:exist.name,
						email:exist.email
					})
				})

			}else{
				return res.status(400).json({
					msg:"wrong password"
				})
			}
		}
	}catch(err){
		return res.status(400).json({
			msg:"error while signing in"
		})
	}
});

function generateToken(payload){
	return jwt.sign(payload , "secret123" , {expiresIn:"30d"});
}

module.exports = router;