var Q = require('q')
,	sc = require('./lib/snapchat')
,	client = new sc.Client()
,	fs = require('fs')
,	util = require('util'),
express = require('express'),
underscore = require('underscore'),
async = require('async'),
cloudinary = require('cloudinary');

cloudinary.config({ 
  cloud_name: 'dvu5h8j4j', 
  api_key: '572446311263763', 
  api_secret: 'lygs55vQSAk3lMxZtOPrDeTM0iA' 
});

var mmm = require('mmmagic'),
	Magic = mmm.Magic;

var magic = new Magic(mmm.MAGIC_MIME_TYPE);


var NSC = function() {
	var nsc = this;

	nsc.constants = {
		username: '',
		password: ''
	}

	nsc.config = {
		activeUser : false,
		auth_token : false
	}

	nsc.busy = false;

	//methods
	nsc.getUserData = function(cb) {
		client.login(constants.username,constants.password).then(function(data) {
			cb(data);
		});
	}
	nsc.getSnaps = function(cb) {
		client.login(constants.username,constants.password).then(function(data) {
			
			// Handle any problems, such as wrong password
			if (typeof data.snaps === 'undefined') {
				return;
			}

			nsc.config.auth_token = data.auth_token;

			if(data.snaps.length == 0) {
				cb('nosnaps');
				return;
			}

			var updates = {};

			var i = 0;
			var max = data.snaps.length;
			var last = false;

			var existingFiles = [];

			fs.readdir(__dirname+'/content/snaps/'+nsc.constants.username+'/', function(err, files) {
				files = files.filter(function(file) {
					return file.indexOf('.jpg') !== -1;
				});


				existingFiles = files;

				////////
				////////
				////////
				////////

				async.each(data.snaps, function(snap, callback) {
					var type = snap.id.split('').filter(function(character) { return [0,1,2,3,4,5,6,7,8,9].indexOf(parseInt(character)) == -1;	}).join('');

					if(snap.sn !== 'teamsnapchat' && (type == 'r' && (snap.m == 0 || snap.m == 1 || snap.m == 2) && snap.st == 1)) {
						if(parseInt(existingFiles.join('').indexOf(snap.id)) == -1) {

							var saveImage = function(name) {
								//supply snapchat api with updated data for snaps
								updates[snap.id] = {
									t: new Date().getTime(),
									c: 0,
									replayed: 0
								}

								var dir = './content/snaps/'+constants.username+'/'+ name+'.sndownload';
								var stream = fs.createWriteStream(dir, { flags: 'w', encoding: null, mode: 0666 });

								stream.on('open', function() {
									client.getBlob(snap.id)
									.then(function(blob) {
										blob.pipe(stream);
										blob.on('error', function(data) {
											callback();
										});
										blob.on('end', function(data) {
											magic.detectFile(dir, function(err, result) {
												if (err) console.log(err)

												var ext;
												if(result == 'image/jpeg') {
													ext = '.jpg';
												} else if(result == 'video/mp4') {
													ext = '.mp4'
												}

												if(ext) {
													fs.rename(dir, dir.replace('.sndownload', ext), function(err) {
														if (err) console.log(err)

														cloudinary.uploader.upload(dir.replace('.sndownload', ext), function(result) {
															callback();
														}, { folder: 'arguefeed' });
													});
												} else {
													callback();
												}
											});	
										});
									});
								});
							}

							if(typeof snap.t !== 'undefined' && typeof snap.sn !== 'undefined') {
								console.log('Saving snap from ' + snap.sn + '...' + snap.id);
								saveImage(snap.sn + '_' + snap.id);
							} else {
								if(snap.rp && snap.st !== 2) {
									console.log('you have a snap that is pending for '+snap.rp);
									saveImage(snap.rp + '_' + snap.id);
								} else {
									callback();
								}
							}
						} else { callback();}
					} else { callback();}
				}, function(err){
					// if any of the file processing produced an error, err would equal that error
					if( err ) {
						// One of the iterations produced an error.
						// All processing will now stop.
						console.log('A snap failed to process');
					} else {

						client.sync(
							constants.username,
							nsc.config.auth_token,
							updates,
							function(data){
								console.log('synced data');
								cb('success');
							}
						);

						console.log('All snaps have been processed successfully');
					}

				});
			});
		});
	}
}



var constants = {
	username: 'inter-snap',
	password: 'gibson007'
};

var isVideo = false;
var busy = 0;
var loggedIn = false;

//LIB

var getUserData = function(callback) {
	client.login(constants.username,constants.password).then(function(data) {
		callback(data);
	});
};

//NETCODE


var fs = require("fs");
var port = process.env.PORT || 3000;
var express = require("express");

var app = express();
app.use(app.router); //use both root and other routes below
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(__dirname + "/public")); //use static files in ROOT/public folder

app.all('/*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	next();
});

var snaps = new NSC();

app.get("/readUserData",function(req,res) {
	if(loggedIn == true) {
		snaps.getUserData(function(data) {
			res.send(data);
		});
	} else {
		res.send(false)
	}
});

app.get("/download",function(req,res) {
	snaps.getSnaps(function(log) {
		if(log == 'nosnaps') { console.log('no snaps to download') };
		res.send(log);
	});
});

app.get("/readImages",function(req,res) {
	if(loggedIn == true) {
		var continueDown = function() {
			fs.readdir(__dirname+'/content/snaps/'+constants.username+'/', function(err,files) {
				if(err) {
					res.send(err);
				} else {
					files = files.filter(function(file) {
						return file.indexOf('.jpg') !== -1 || file.indexOf('.mp4') !== -1;
					});
					
					res.send({dir:'/snaps/'+constants.username+'/',data:files});
				}
			});
		}
		continueDown();
	} else {
		res.send(false)
	}
});

app.get("/addUser/:username", function(req, res) {
	if(loggedIn == true) {
		client.addFriend(req.params.username).then(function(data) {
			res.send(data);
		}, function(err) {
			res.send('fail');
		});
	} else {
		res.send(false)
	}
});

app.use("/login",function(req,res) {
	client.login(constants.username,constants.password).then(function(data) {
		res.send('success');
		loggedIn = true;

		// Make sure the images folder exists
		if(!fs.existsSync(__dirname+'/content/snaps/'+constants.username)) {
			fs.mkdir(__dirname+'/content/snaps/'+constants.username);
		}

		var state = 0;
		setInterval(function() {
			if(state == 0 && busy == 0) {
				state = 1;
				snaps.getSnaps(function() {
					state = 0;
				});
			}
		},20000);

	}, function(err) {
		console.log(err)
		res.send('fail');
	});
});

app.use(express.static(__dirname + '/content'));

app.listen(port);
console.log('Started node snapchat-server @ port: '+port);