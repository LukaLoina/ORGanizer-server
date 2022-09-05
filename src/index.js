import express from 'express'
import bodyParser from 'body-parser'
import passport from 'passport'
import passportApi from 'passport-localapikey'
import crypto from 'crypto'

const app = express()
const port = 3000

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Store hardcoded useers in array while developing app.
// TODO: replace array storage with database
const keys = {}
const users = [{"username": "test", "password": "testpassword"}]
// Store synced notes in array while developing app.
// TODO: replace array storage with database to keep notes between server restarts
const notes = []
function removeNoteChildren(note, keep = []){
    /*Remove notes that are removed from notes sent to server. */
    var idsToRemove = note.children
    if(keep.length > 0){
	idsToRemove = idsToRemove.filter(child => !keep.includes(child))
    }
    
    notes.filter(note => idsToRemove.includes(note.id)).forEach(note => {
	removeNoteChildren(note, [])
	const index = notes.indexOf(note)
	if(index > -1){
	    notes.splice(index, 1)
	}
    })
}

const LocalAPIKeyStrategy = passportApi.Strategy

passport.use(new LocalAPIKeyStrategy(
    {apiKeyField: 'apikey'},
    function(apikey, done) {
	if(keys[apikey] == undefined){
	    return done("invalid key", null)
	}

	const username = keys[apikey]
	const user = users.find(user => user.username == username)
	if(user == undefined){
	    return done("user not found", null)
	}
	return done(null, user)
    }
));

const withAuthentication = passport.authenticate('localapikey', {session: false, failureMessage: true})

app.use(passport.initialize());

app.post('/login', (req, res) => {
    const username = req.body.username
    const password = req.body.password
    
    if(!username || !password){ return res.status(400).json({}) }

    const user = users.find(user => user.username == username)
    if(!user){return res.status(400).json({})}

    
    if(user.password != password){return res.status(400).json({})}
    
    var key = crypto.randomBytes(32).toString('hex');
    keys[key] = username
    res.json({token: key})
})

app.get('/notes', withAuthentication, (req, res) => {
    const response = notes.map((note) => {
	return {"id": note.id, "hash": note.hash, "timestamp": note.timestamp, "title": note.title}
    })
    res.json({"items":response})
})

app.get('/note/:id', withAuthentication, (req, res) => {
    const id = req.params.id
    if(!id){
	res.sendStatus(400);
	return
    }
    var note = notes.find((note) => note.id && (id === note.id))
    if(note === undefined){
	note = {"hash": "", "timestamp": 0}
    }
    res.json(note)
})

app.post('/note/:id', withAuthentication, (req, res) => {
    const id = req.params.id
    if(!id){
	res.sendStatus(400);
	return
    }
    const note = req.body
    const foundNote = notes.find((note) => note.id && (id === note.id))
    if(foundNote !== undefined){
	foundNote.id = note.id
	foundNote.hash = note.hash
	foundNote.contentHash = note.contentHash
	foundNote.title = note.title
	foundNote.body = note.body
	foundNote.parentId = note.parentId
	foundNote.timestamp = note.timestamp
	foundNote.properties = note.properties
	
	removeNoteChildren(foundNote, note.children)
	
	foundNote.children = note.children
    } else {
	notes.push(note)
    }
    res.json({})
})

app.get('/note/metadata/:id', withAuthentication, (req, res) => { 
    const id = req.params.id
    if(!id){
	res.sendStatus(400);
	return
    }
    var note = notes.find((note) => note.id && (id === note.id))
    if(note === undefined){
	note = {"hash": "", "contentHash": "", "timestamp": 0, children: []}
    } else {
	const children = notes.filter((notes_entry) => notes_entry.parentId === note.id).map( child => {return {"id": child.id, "hash": child.hash}})
	note = {
	    "id": note.id,
	    "hash": note.hash,
	    "contentHash": note.contentHash,
	    "timestamp": note.timestamp,
	    "children": children
	}
    }
    res.json(note)
})

app.post('/note/metadata/:id', withAuthentication, (req, res) => {
    const id = req.params.id
    if(!id){
	res.sendStatus(400);
	return
    }
    const note = req.body
    const foundNote = notes.find((note) => note.id && (id === note.id))
    if(foundNote !== undefined){
	foundNote.id = note.id
	foundNote.hash = note.hash
	foundNote.parentId = note.parentId
	foundNote.timestamp = note.timestamp

	removeNoteChildren(foundNote, note.children)
	
	foundNote.children = note.children
	res.json({})
    } else {
	res.status(404).json({})
    }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

