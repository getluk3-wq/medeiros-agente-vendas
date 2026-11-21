
const db=require('./db');
const getSettings=()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x=>[x.key,x.value]));
async function reply(phone,text){
 const s=getSettings();
 if(s.ai_enabled==='1' && process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL){
  try{
   const catalog={
    services:db.prepare('SELECT name,description,price FROM services WHERE active=1').all(),
    products:db.prepare('SELECT name,description,price,url FROM products WHERE active=1').all()
   };
   const history=db.prepare('SELECT direction,body FROM messages WHERE phone=? ORDER BY id DESC LIMIT 10').all(phone).reverse();
   const r=await fetch(process.env.AI_BASE_URL.replace(/\/$/,'')+'/chat/completions',{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.AI_MODEL,temperature:0.4,messages:[
     {role:'system',content:`Você é o atendente comercial da ${s.business_name}. Converse em português brasileiro, entenda a necessidade e seja educado. Use apenas os preços e condições do catálogo: ${JSON.stringify(catalog)}. Nunca invente preço, prazo, estoque, pagamento ou garantia. Desconto máximo autorizado: ${s.discount_limit}%. Se não souber, encaminhe para Rafael. Não faça spam.`},
     ...history.map(m=>({role:m.direction==='in'?'user':'assistant',content:m.body})),
     {role:'user',content:text}
    ]})
   });
   if(r.ok){const j=await r.json();const answer=j.choices?.[0]?.message?.content?.trim();if(answer)return answer;}
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
module.exports={reply};
