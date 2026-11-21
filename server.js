require('dotenv').config();
const express=require('express');
const session=require('express-session');
const helmet=require('helmet');
const bcrypt=require('bcryptjs');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const db=require('./db');
const wa=require('./whatsapp');
const assistant=require('./assistant');

const app=express();
const server=http.createServer(app);
const io=new Server(server);
const PORT=Number(process.env.PORT)||3000;
const username=process.env.ADMIN_USER||'rafael';
const password=process.env.ADMIN_PASSWORD||'';
const secret=process.env.SESSION_SECRET||'';

if(password.length<12 || secret.length<32){
  console.error('Configure ADMIN_PASSWORD (mínimo 12 caracteres) e SESSION_SECRET (mínimo 32 caracteres) nas variáveis de ambiente.');
  process.exit(1);
}
const passwordHash=bcrypt.hashSync(password,12);
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'256kb'}));
app.use(session({
  name:'medeiros.sid',
  secret,
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,secure:'auto',sameSite:'lax',maxAge:8*60*60*1000}
}));

const attempts=new Map();
function auth(req,res,next){
  if(req.session.user===username)return next();
  return res.status(401).json({error:'Não autenticado'});
}
app.get('/health',(req,res)=>res.json({ok:true,service:'medeiros-agente-vendas'}));
app.get('/api/me',(req,res)=>res.json({loggedIn:req.session.user===username}));
app.post('/api/login',async(req,res)=>{
  const ip=req.ip||'unknown';
  const item=attempts.get(ip)||{count:0,until:0};
  if(item.until>Date.now()&&item.count>=8)return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
  const valid=req.body?.user===username && await bcrypt.compare(String(req.body?.password||''),passwordHash);
  if(!valid){
    item.count+=1;
    if(item.count>=8)item.until=Date.now()+10*60*1000;
    attempts.set(ip,item);
    return res.status(401).json({error:'Usuário ou senha incorretos'});
  }
  attempts.delete(ip);
  req.session.regenerate(err=>{
    if(err)return res.status(500).json({error:'Não foi possível iniciar a sessão'});
    req.session.user=username;
    req.session.save(e=>e?res.status(500).json({error:'Falha ao salvar sessão'}):res.json({ok:true}));
  });
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('medeiros.sid');res.json({ok:true});}));
app.use('/api',auth);

const count=table=>db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
app.get('/api/summary',(req,res)=>res.json({
  contacts:count('contacts'),messages:count('messages'),services:count('services'),
  products:count('products'),whatsapp:wa.getStatus()
}));
app.get('/api/settings',(req,res)=>res.json(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]))));
app.put('/api/settings',(req,res)=>{
  const allowed=['business_name','owner_whatsapp','greeting','discount_limit','ai_enabled'];
  if(req.body?.ai_enabled==='1'&&!assistant.aiConfigured())
    return res.status(400).json({error:'Antes de ativar a IA, configure AI_BASE_URL, AI_API_KEY e AI_MODEL no ambiente do Render.'});
  const save=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for(const k of allowed)if(req.body?.[k]!==undefined)save.run(k,String(req.body[k]).slice(0,2000));
  res.json({ok:true});
});
app.get('/api/ai/status',(req,res)=>res.json({
 configured:assistant.aiConfigured(),
 enabled:Object.fromEntries(db.prepare('SELECT key,value FROM settings WHERE key=?').all('ai_enabled')).ai_enabled==='1',
 provider:process.env.AI_BASE_URL&&process.env.AI_BASE_URL.includes('groq.com')?'Groq':'Provedor configurado',
 model:process.env.AI_MODEL||''
}));
app.post('/api/ai/test',async(req,res)=>{
 if(!assistant.aiConfigured())return res.status(400).json({error:'A chave da IA ainda não foi configurada no Render.'});
 try{res.json(await assistant.testConnection());}
 catch(e){res.status(502).json({error:e.message||'Falha ao testar a IA.'});}
});
for(const table of ['services','products']){
  app.get('/api/'+table,(req,res)=>res.json(db.prepare('SELECT * FROM '+table+' ORDER BY id DESC').all()));
  app.post('/api/'+table,(req,res)=>{
    const name=String(req.body?.name||'').trim().slice(0,160);
    const description=String(req.body?.description||'').slice(0,2000);
    const price=Number(req.body?.price);
    const url=String(req.body?.url||'').trim().slice(0,2000);
    if(!name)return res.status(400).json({error:'Informe o nome.'});
    if(!Number.isFinite(price)||price<0)return res.status(400).json({error:'Preço inválido.'});
    if(table==='products'&&url&&!/^https:\/\//i.test(url))return res.status(400).json({error:'O link precisa começar com https://'});
    const info=table==='products'
      ?db.prepare('INSERT INTO products(name,description,price,url) VALUES(?,?,?,?)').run(name,description,price,url)
      :db.prepare('INSERT INTO services(name,description,price) VALUES(?,?,?)').run(name,description,price);
    res.json({ok:true,id:info.lastInsertRowid});
  });
}
app.get('/api/conversations',(req,res)=>res.json(db.prepare('SELECT phone,COUNT(*) AS total,MAX(created_at) AS last_message FROM messages GROUP BY phone ORDER BY MAX(id) DESC').all()));
app.get('/api/messages/:phone',(req,res)=>res.json(db.prepare('SELECT id,phone,direction,body,created_at FROM messages WHERE phone=? ORDER BY id DESC LIMIT 100').all(req.params.phone).reverse()));
app.get('/api/whatsapp',(req,res)=>res.json(wa.getStatus()));
app.post('/api/whatsapp/start',(req,res)=>{
  if(process.env.WHATSAPP_ENABLED!=='true')return res.status(403).json({error:'WhatsApp permanece desligado por segurança. Não conecte antes de definir a estratégia para preservar o número usado pelo robô antigo.'});
  wa.start(io);
  res.json(wa.getStatus());
});
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.use((req,res)=>res.status(404).json({error:'Rota não encontrada'}));
io.on('connection',socket=>socket.emit('wa',wa.getStatus()));
server.listen(PORT,'0.0.0.0',()=>console.log('MEDEIROS DIGITAL Agente iniciado na porta '+PORT));
