(() => {
'use strict';
const $ = id => document.getElementById(id);
const cfg = window.BRISA_CONFIG || {};
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl || '') && cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes('TU_CLAVE');
let sb = null, room = '', name = '', myId = '', timer = null, busy = false, firstLoad = true, pendingPhoto = null, lastSignature = '';
const KEEP = 600000;
const $$ = (tag, cls, txt) => { const el=document.createElement(tag); if(cls)el.className=cls; if(txt!==undefined)el.textContent=txt; return el; };
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3600);}
function newRoom(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
function getRoom(){const match=location.hash.match(/(?:^#|&)sala=([a-f0-9]{48})(?:&|$)/);if(match)return match[1];const id=newRoom();history.replaceState(null,'',location.pathname+location.search+'#sala='+id);return id;}
const timeLabel = t => new Intl.DateTimeFormat('es-CR',{hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(t));
function applyTheme(theme){const dark=theme==='dark';document.body.classList.toggle('dark',dark);$('themeBtn').textContent=dark?'☀':'☾';localStorage.setItem('brisa_theme',theme);document.querySelector('meta[name="theme-color"]').content=dark?'#111b21':'#e9edef';}
$('themeBtn').addEventListener('click',()=>applyTheme(document.body.classList.contains('dark')?'light':'dark'));
applyTheme(localStorage.getItem('brisa_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light'));
room=getRoom();$('roomName').textContent='Sala '+room.slice(0,6).toUpperCase();
$('shareBtn').addEventListener('click', async()=>{try {await navigator.clipboard.writeText(location.href);toast('Enlace copiado. Compartilo con tus invitados.');}catch{prompt('Copiá este enlace:',location.href);}});
const savedName=localStorage.getItem('brisa_name');if(savedName)$('nameInput').value=savedName;
if(!configured){$('welcomeHeading').textContent='Falta configurar Supabase';$('status').textContent='Configuración pendiente';toast('Editá config.js y ejecutá los scripts SQL antes de publicar.');}
$('joinForm').addEventListener('submit',async e=>{
 e.preventDefault();name=$('nameInput').value.trim().replace(/\s+/g,' ').slice(0,28);
 if(!name)return;
 if(!configured){toast('Primero configurá URL y clave pública en config.js');return;}
 if(!window.supabase?.createClient){toast('No se pudo cargar Supabase. Revisá Internet y el CDN.');return;}
 localStorage.setItem('brisa_name',name);
 myId=sessionStorage.getItem('brisa_id') || crypto.randomUUID();sessionStorage.setItem('brisa_id',myId);
 sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false},realtime:{params:{eventsPerSecond:2}}});
 try{const {error}=await sb.rpc('brisa_feed',{p_room:room});if(error)throw error;
 $('joinOverlay').classList.add('hidden');$('status').textContent='Conectado';await refresh();timer=setInterval(refresh,Math.max(1500,cfg.pollingMs||2500));$('msgInput').focus();
 }catch(err){toast('No se pudo conectar: '+friendly(err));}
});
function friendly(e){return String(e?.message||e||'Error inesperado').slice(0,220);}
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data;}
function signature(list){return list.map(x=>`${x.id}:${x.photo_available?'1':'0'}:${x.expires_at}`).join('|');}
async function refresh(){if(busy||!sb)return;busy=true;try{
 const result=await rpc('brisa_feed',{p_room:room});const list=Array.isArray(result)?result:[];
 const sig=signature(list);
 if(sig!==lastSignature || firstLoad){render(list);lastSignature=sig;firstLoad=false;}
 $('status').textContent='Conectado';
 }catch(err){$('status').textContent='Sin conexión';if(firstLoad)toast(friendly(err));}finally{busy=false;}}
function render(list){const wrap=$('messages');const nearBottom=wrap.scrollHeight-wrap.scrollTop-wrap.clientHeight<140;wrap.replaceChildren();
 if(!list.length){const empty=$$('div','empty');empty.innerHTML='<div class="empty-icon">✦</div><h2>Tu conversación empieza aquí</h2><p>Compartí el enlace de esta sala y empezá a conversar.</p>';wrap.append(empty);return;}
 for(const m of list){const mine=m.sender_id===myId;const msg=$$('div','message '+(mine?'mine':'other'));const bubble=$$('div','bubble');if(!mine)bubble.append($$('span','sender-name',m.sender_name||'Invitado'));
 if(m.kind==='text')bubble.append($$('div','body-text',m.text_body||''));
 else {const btn=$$('button','photo-btn');const icon=$$('span','photo-symbol','◉');const t=$$('span');const title=$$('strong','',m.photo_available?(mine?'Foto enviada · una vista':'Ver foto · una vista'):'Foto ya abierta');const sub=$$('small','',m.photo_available?(mine?'Esperando que alguien la abra':'Tocá para abrirla solo una vez'):'Contenido no disponible');t.append(title,sub);btn.append(icon,t);btn.disabled=!m.photo_available||mine;if(!mine&&m.photo_available)btn.onclick=()=>{pendingPhoto=m.id;$('confirmOverlay').classList.remove('hidden');};bubble.append(btn);}
 const meta=$$('div','meta');meta.append($$('span','',timeLabel(m.created_at)));const left=Math.max(0,Math.ceil((Date.parse(m.expires_at)-Date.now())/60000));meta.append($$('span','',`· ${left} min`));bubble.append(meta);msg.append(bubble);wrap.append(msg);
 }
 if(nearBottom||firstLoad)wrap.scrollTop=wrap.scrollHeight;
}
async function send(kind,body){if(!sb){toast('Entrá a la sala para enviar.');return;}if(!body)return;
 $('sendBtn').disabled=true;$('attachBtn').disabled=true;
 try{await rpc('brisa_send',{p_room:room,p_sender:myId,p_name:name,p_kind:kind,p_payload:body});if(kind==='text')$('msgInput').value='';await refresh();const el=$('messages');el.scrollTop=el.scrollHeight;
 }catch(err){toast('No se pudo enviar: '+friendly(err));}finally{$('sendBtn').disabled=false;$('attachBtn').disabled=false;}}
$('sendBtn').onclick=()=>send('text',$('msgInput').value.trim());
$('msgInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send('text',$('msgInput').value.trim());}});
$('attachBtn').onclick=()=>{if(!sb){toast('Primero entrá a la sala.');return;}$('imagePicker').click();};
$('imagePicker').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!file.type.startsWith('image/')){toast('Seleccioná una imagen.');return;}
 if(file.size>12*1024*1024){toast('Elegí una foto menor a 12 MB.');return;}
 try{toast('Preparando foto de una vista…');const b64=await compress(file);if(b64.length>240000)throw new Error('La foto todavía es demasiado grande.');await send('photo',b64);}catch(err){toast('No se pudo preparar la foto: '+friendly(err));}
});
function loadImg(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Archivo no es una imagen válida.'));};img.src=url;});}
async function compress(file){const im=await loadImg(file);const canvas=document.createElement('canvas');let max=1100;let ratio=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));canvas.width=Math.max(1,Math.round(im.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(im.naturalHeight*ratio));const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(im,0,0,canvas.width,canvas.height);let quality=.76,data='';for(let i=0;i<6;i++){data=canvas.toDataURL('image/jpeg',quality);if(data.length<225000)break;quality=Math.max(.25,quality-.12);if(i===3){canvas.width=Math.round(canvas.width*.8);canvas.height=Math.round(canvas.height*.8);context.drawImage(im,0,0,canvas.width,canvas.height);}}return data;}
$('cancelOpen').onclick=()=>{$('confirmOverlay').classList.add('hidden');pendingPhoto=null;};
$('confirmOpen').onclick=async()=>{if(!pendingPhoto)return;const id=pendingPhoto;pendingPhoto=null;$('confirmOverlay').classList.add('hidden');try{const result=await rpc('brisa_open_photo',{p_room:room,p_id:id});if(!result){toast('Esta foto ya fue vista o expiró.');await refresh();return;}if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result)){throw new Error('Formato de imagen inválido');}
 const img=new Image();img.src=result;img.alt='Foto de una vista';$('photoContent').replaceChildren(img);$('photoOverlay').classList.remove('hidden');await refresh();
 }catch(err){toast(friendly(err));}};
function closePhoto(){const im=$('photoContent').querySelector('img');if(im)im.src='';$('photoContent').replaceChildren();$('photoOverlay').classList.add('hidden');}
$('closePhoto').onclick=closePhoto;$('photoOverlay').addEventListener('click',e=>{if(e.target===$('photoOverlay'))closePhoto();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
