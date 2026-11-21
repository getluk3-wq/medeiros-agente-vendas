const db=require('./db');
const getSettings=()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
function aiConfigured(){
 return Boolean(process.env.AI_BASE_URL&&process.env.AI_API_KEY&&process.env.AI_MODEL);
}
async function requestAI(messages){
 const base=String(process.env.AI_BASE_URL||'').replace(/\/$/,'');
 if(!base||!process.env.AI_API_KEY||!process.env.AI_MODEL)throw new Error('Credenciais da IA não configuradas no servidor.');
 const response=await fetch(base+'/chat/completions',{
  method:'POST',
  headers:{Authorization:'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.AI_MODEL,messages}),
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok){
  if(response.status===429)throw new Error('Limite gratuito da IA atingido. Aguarde e tente novamente.');
  if(response.status===401||response.status===403)throw new Error('A chave da IA foi recusada. Confira a variável AI_API_KEY no Render.');
  throw new Error('O provedor de IA retornou erro HTTP '+response.status+'.');
 }
 const data=await response.json();
 const answer=data.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim())throw new Error('A IA não retornou uma resposta de texto.');
 return answer.trim();
}
async function testConnection(){
 const answer=await requestAI([{role:'user',content:'Responda exatamente: conexão funcionando.'}]);
 return {ok:true,message:answer};
}
async function reply(phone,text){
 const s=getSettings();
 if(s.ai_enabled==='1'&&aiConfigured()){
  try{
   const catalog={
    services:db.prepare('SELECT name,description,price FROM services WHERE active=1').all(),
    products:db.prepare('SELECT name,description,price,url FROM products WHERE active=1').all()
   };
   const history=db.prepare('SELECT direction,body FROM messages WHERE phone=? ORDER BY id DESC LIMIT 11').all(phone).reverse();
   // A mensagem recebida já foi gravada pelo webhook; não a envie duas vezes.
   const last=history[history.length-1];
   const prior=last&&last.direction==='in'&&last.body===text?history.slice(0,-1):history.slice(-10);
   const system=`Você é o atendente comercial da ${s.business_name}, no Brasil. Atenda em português brasileiro, com simpatia, naturalidade e objetividade; não diga que é humano. Descubra o que a pessoa precisa fazendo uma pergunta por vez. Apresente somente serviços e produtos existentes no catálogo abaixo, com os preços cadastrados. Não invente desconto, prazo, disponibilidade, pagamento, entrega, garantia, resultado ou condição. O desconto máximo autorizado é ${s.discount_limit||'0'}%; não ofereça desconto acima disso. Se o cliente estiver pronto para contratar, confirme o serviço/produto e os dados necessários e diga que Rafael dará continuidade para combinar pagamento e prazo. Não declare uma venda concluída nem peça dados sensíveis, senhas ou códigos. Para algo fora do catálogo, diga que Rafael fará uma avaliação. Nunca envie mensagens não solicitadas nem pressione o cliente. Catálogo: ${JSON.stringify(catalog)}. WhatsApp comercial: ${s.owner_whatsapp||''}.`;
   return await requestAI([
    {role:'system',content:system},
    ...prior.map(m=>({role:m.direction==='in'?'user':'assistant',content:m.body})),
    {role:'user',content:text}
   ]);
  }catch(e){console.error('IA indisponível:',e.message);}
 }
 const t=String(text||'').toLowerCase();
 if(/^(oi|olá|ola|bom dia|boa tarde|boa noite)/.test(t))return s.greeting;
 if(/site|logo|arte|banner|catálogo|catalogo|cardápio|cardapio|aplicativo|automação|automacao|sistema/.test(t)){
  const rows=db.prepare('SELECT name,price FROM services WHERE active=1').all();
  return rows.length?'Posso te ajudar com estes serviços:\n'+rows.map(x=>`• ${x.name} — R$ ${Number(x.price).toFixed(2).replace('.',',')}`).join('\n')+'\nQual deles você procura?':'Legal! Me conta o que você precisa e vou organizar as informações para o Rafael preparar uma proposta.';
 }
 if(/shopee|produto|oferta|promoção|promocao|comprar/.test(t)){
  const rows=db.prepare('SELECT name,price,url FROM products WHERE active=1 LIMIT 5').all();
  return rows.length?'Encontrei estas opções cadastradas:\n'+rows.map(x=>`• ${x.name} — R$ ${Number(x.price).toFixed(2).replace('.',',')}\n${x.url}`).join('\n'):'Qual produto ou categoria você está procurando? Posso verificar as opções cadastradas.';
 }
 return 'Entendi! Você procura um serviço digital da MEDEIROS DIGITAL ou um produto/oferta? Pode me explicar com suas palavras para eu te orientar melhor.';
}
module.exports={reply,aiConfigured,testConnection};
