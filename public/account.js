window.flightAccount = (() => {
  let values={},revision=0,dirty=false,busy=false,conflict=false,timer;
  const map={'emoji3d_screenshot_airport_v1':'progress','emoji_flight_custom_airlines_v1':'airlines'};
  let status;
  const storage={getItem:key=>values[map[key]]||null,setItem:(key,value)=>{if(!map[key])return;values[map[key]]=value;dirty=true;status.textContent='Saving…';clearTimeout(timer);timer=setTimeout(flush,350)}};
  async function flush(){
    if(busy||!dirty||conflict)return !dirty;
    busy=true;dirty=false;
    try{
      const response=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json','X-Flight-App':'1'},body:JSON.stringify({save:values,revision})});
      const result=await response.json();
      if(!response.ok){if(response.status===409||response.status===401)conflict=true;throw Error(result.error)}
      revision=result.revision;status.textContent='✓ Saved to database';
    }catch(e){dirty=true;status.textContent='Not saved: '+e.message}
    finally{busy=false}
    if(dirty&&!conflict)timer=setTimeout(flush,3000);
    return !dirty;
  }
  async function init(){
    const response=await fetch('/api/me');if(!response.ok)throw Error('Could not load your save');
    const user=await response.json();if(!user.username){location.replace('/');throw Error('Sign in required')}
    values=user.save;revision=user.revision;
    const bar=document.createElement('div');bar.style.cssText='padding:10px 18px;background:#061321;display:flex;align-items:center;gap:16px;flex-wrap:wrap';
    const name=document.createElement('strong');name.textContent='👤 '+user.username;
    status=document.createElement('span');status.setAttribute('role','status');status.textContent='✓ Save loaded';status.style.flex='1';
    const retry=document.createElement('button');retry.textContent='Save now';retry.onclick=()=>flush();
    const logout=document.createElement('button');logout.textContent='Save & sign out';logout.onclick=async()=>{logout.disabled=true;try{if(!await flush()){status.textContent='Please wait for saving to finish before signing out.';return}const r=await fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json','X-Flight-App':'1'},body:'{}'});if(!r.ok)throw Error('Sign out failed');location.href='/'}catch(e){status.textContent=e.message}finally{logout.disabled=false}};
    bar.append(name,status,retry,logout);document.body.prepend(bar);
    window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue=''}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
  }
  return {init,storage};
})();
