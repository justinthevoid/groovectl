import {App,applyDocumentTheme,applyHostStyleVariables} from '@modelcontextprotocol/ext-apps';
import {OpenAIExtensions} from '@openai/mcp-extensions/app';

const app=new App({name:'Apple Music Hybrid',version:'0.1.3'});
const extensions=new OpenAIExtensions(app);
let state, busy=false;
const $=id=>document.getElementById(id);
const text=(id,value)=>{ $(id).textContent=value; };
const notice=message=>text('notice',message);
function theme(context){if(context?.theme)applyDocumentTheme(context.theme);if(context?.styles?.variables)applyHostStyleVariables(context.styles.variables);}
function render(data){
  if(!data)return;state=data;
  const p=data.player||{}, t=p.track;
  text('song',t?.name||'Nothing playing');text('artist',t?[t.artist,t.album].filter(Boolean).join(' · '):'Music.app on this Mac');
  text('state',p.running?p.state:'Music.app is closed');$('volume').value=p.volume??50;
  text('volume-label',`Volume ${p.volume??50}%`);
  text('auth',data.auth?.user_authorized?'Apple Music connected':data.auth?.developer_key_configured?'Catalog ready · Library sign-in pending':'MusicKit setup pending');
  const root=$('plans');root.replaceChildren();
  const plans=data.plans||[];
  $('empty').hidden=plans.length>0;
  for(const plan of plans){
    const card=document.createElement('section');card.className='plan';
    const heading=document.createElement('h3');heading.textContent=plan.payload.name;card.append(heading);
    const detail=document.createElement('p');detail.className='muted';detail.textContent=`${plan.payload.operation==='append'?'Add to playlist':'New playlist'} · ${plan.payload.tracks.length} tracks · ${plan.payload.audit.duration_minutes} min · ${plan.state.replaceAll('_',' ')}`;card.append(detail);
    const list=document.createElement('ol');
    for(const track of plan.payload.tracks){const li=document.createElement('li');const title=document.createElement('strong');title.textContent=track.name;const artist=document.createElement('span');artist.textContent=` — ${track.artist}`;li.append(title,artist);list.append(li);}card.append(list);
    if(plan.payload.audit.version_qualifiers.length){const warning=document.createElement('p');warning.textContent='Contains alternate or remastered versions. Check these recordings before creating.';warning.className='warning';card.append(warning);}
    if(plan.state==='ready'){
      const row=document.createElement('div');row.className='actions';
      for(const [label,name] of [[plan.payload.operation==='append'?'Add tracks':'Create playlist','apply_playlist_plan'],['Cancel preview','cancel_playlist_plan']]){
        const button=document.createElement('button');button.className='cursor-interaction';button.textContent=label;button.onclick=()=>act(name,{plan_id:plan.plan_id});row.append(button);
      }card.append(row);
    }
    if(plan.state==='unknown'||plan.state==='needs_review'){const warning=document.createElement('p');warning.className='warning';warning.textContent='Inspect the library before acting again. This write will not be retried automatically.';card.append(warning);}
    root.append(card);
  }
}
async function call(name,args={}){const r=await app.callServerTool({name,arguments:args});if(r.isError)throw new Error(r.content?.find(c=>c.type==='text')?.text||'Tool call failed.');return r.structuredContent;}
async function act(name,args){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');notice('Working…');try{await call(name,args);render(await call('get_music_workspace'));notice('Updated.');}catch(e){notice(e.message);}finally{busy=false;document.body.removeAttribute('aria-busy');}}
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>act('control_playback',{action:b.dataset.action});
$('refresh').onclick=()=>act('get_music_workspace',{});
$('volume').onchange=()=>act('control_playback',{action:'volume',value:Number($('volume').value)});
$('volume').oninput=()=>text('volume-label',`Volume ${$('volume').value}%`);
app.ontoolresult=result=>render(result.structuredContent);
app.addEventListener('hostcontextchanged',theme);
// Static, synthetic preview only. It never exposes library data or calls the Mac controller.
if(new URLSearchParams(location.search).get('preview')==='1'){
  render({player:{running:false,state:'stopped'},auth:{developer_key_configured:true,user_authorized:false},plans:[]});
  text('auth','Interface preview · Your music stays on this Mac');
  for(const el of document.querySelectorAll('button,input'))el.disabled=true;
  notice('Interface preview. Open the installed plugin to control Apple Music.');
}else{
  try{await app.connect();theme(app.getHostContext());notice('Ready.');}catch(e){notice('Open Apple Music Hybrid inside an MCP Apps host to connect.');}
}
