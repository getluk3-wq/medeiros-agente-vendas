
require('dotenv').config();
const express=require('express'),session=require('express-session'),helmet=require('helmet'),bcrypt=require('bcryptjs');
const http=require('http'),path=require('path'),{Server}=require('socket.io');
const db=require('./db'),wa=require('./whatsapp');
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'}));
app.use(session({secret:process.env.SESSION_SECRET||'change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',maxAge:8*60*60*1000}}));
const username=process.env.ADMIN_USER||'rafael';
const hash=bcrypt.hashSync(process.env.ADMIN_PASSWORD||'troque-esta-senha',10);
function auth(req,res,next){if(req.session.user===username)return next();res.status(401).json({error:'Não autenticado'});}
app.post('/api/login',async(req,res)=>{if(req.body.user===username&&await bcrypt.compare(String(req.body.password||''),hash)){req.session.user=username;return res.json({ok:true});}res.status(401).json({error:'Acesso negado'});});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>res.json({loggedIn:req.session.user===username}));
app.get('/api/health',(req,res)=>res.json({ok:true,app:'medeiros-agente-vendas'}));
app.use('/api',auth);
app.get('/api/summary',(req,res)=>{const count=t=>db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;res.json({contacts:count('contacts'),messages:count('messages'),services:count('services'),products:count('products'),whatsapp:wa.getStatus()});});
app.get('/api/settings',(req,res)=>res.json(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]))));
app.put('/api/settings',(req,res)=>{for(const k of ['business_name','owner_whatsapp','greeting','discount_limit','ai_enabled'])if(req.body[k]!==undefined)db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(req.body[k]));res.json({ok:true});});
for(const table of ['services','products']){
 app.get('/api/'+table,(req,res)=>res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all()));
 app.post('/api/'+table,(req,res)=>{const {name,description='',price=0,url=''}=req.body;if(!name)return res.status(400).json({error:'Nome obrigatório'});const info=table==='products'?db.prepare('INSERT INTO products(name,description,price,url) VALUES(?,?,?,?)').run(name,description,Number(price)||0,url):db.prepare('INSERT INTO services(name,description,price) VALUES(?,?,?)').run(name,description,Number(price)||0);res.json({ok:true,id:info.lastInsertRowid});});
}
app.get('/api/conversations',(req,res)=>res.json(db.prepare('SELECT phone,COUNT(*) total,MAX(created_at) last_message FROM messages GROUP BY phone ORDER BY MAX(id) DESC').all()));
app.get('/api/messages/:phone',(req,res)=>res.json(db.prepare('SELECT * FROM messages WHERE phone=? ORDER BY id DESC LIMIT 100').all(req.params.phone).reverse()));
app.get('/api/whatsapp',(req,res)=>res.json(wa.getStatus()));
app.post('/api/whatsapp/start',(req,res)=>{wa.start(io);res.json(wa.getStatus());});
app.use(express.static(path.join(__dirname,'..','public')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','public','index.html')));
io.on('connection',s=>s.emit('wa',wa.getStatus()));
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Agente MEDEIROS DIGITAL iniciado'));
