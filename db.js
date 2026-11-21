const Database=require('better-sqlite3');
const fs=require('fs');
const path=require('path');
const dataDir=process.env.DATA_DIR||path.join(__dirname,'data');
fs.mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,'agent.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY,name TEXT NOT NULL,description TEXT DEFAULT '',price REAL DEFAULT 0,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,description TEXT DEFAULT '',price REAL DEFAULT 0,url TEXT DEFAULT '',active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY,phone TEXT UNIQUE,name TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,phone TEXT,direction TEXT,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const put=db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
for(const [k,v] of Object.entries({
 business_name:'MEDEIROS DIGITAL / AGÊNCIA DIGITAL',
 owner_whatsapp:'5538991471456',
 greeting:'Olá! Você está falando com a MEDEIROS DIGITAL. Como posso ajudar?',
 discount_limit:'0',
 ai_enabled:'0'
}))put.run(k,v);
module.exports=db;
