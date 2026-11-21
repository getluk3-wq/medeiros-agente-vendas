
const {Client,LocalAuth}=require('whatsapp-web.js');
const QRCode=require('qrcode');
const db=require('./db');
const {reply}=require('./assistant');
let client=null,status='desativado',qr=null;
function start(io){
 if(process.env.WHATSAPP_ENABLED!=='true'){status='desativado';return;}
 if(client)return;
 status='iniciando';
 client=new Client({authStrategy:new LocalAuth({clientId:'medeiros-vendas'}),puppeteer:{headless:true,args:['--no-sandbox','--disable-setuid-sandbox']}});
 client.on('qr',async value=>{qr=await QRCode.toDataURL(value);status='aguardando_qr';io.emit('wa',{status,qr});});
 client.on('ready',()=>{status='conectado';qr=null;io.emit('wa',{status});});
 client.on('auth_failure',e=>{status='erro_autenticacao';io.emit('wa',{status,error:String(e)});});
 client.on('disconnected',e=>{status='desconectado';client=null;io.emit('wa',{status,error:String(e)});});
 client.on('message',async msg=>{
  if(msg.fromMe||msg.from.endsWith('@g.us')||msg.isStatus)return;
  const phone=msg.from.replace('@c.us',''),body=msg.body||'[mensagem sem texto]';
  const contact=await msg.getContact().catch(()=>null);
  db.prepare('INSERT OR IGNORE INTO contacts(phone,name) VALUES(?,?)').run(phone,contact?.pushname||'');
  db.prepare('INSERT INTO messages(phone,direction,body) VALUES(?,?,?)').run(phone,'in',body);
  const answer=await reply(phone,body);
  await client.sendMessage(msg.from,answer);
  db.prepare('INSERT INTO messages(phone,direction,body) VALUES(?,?,?)').run(phone,'out',answer);
  io.emit('new-message',{phone,body,answer});
 });
 client.initialize().catch(e=>{status='erro';client=null;io.emit('wa',{status,error:e.message});});
}
module.exports={start,getStatus:()=>({status,qr})};
