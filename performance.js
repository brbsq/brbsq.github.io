// Optional, read-only diagnostics for local performance verification (?perf=1).
const enabled=new URLSearchParams(location.search).has('perf');
export const stats={frames:0,shelfDraws:0,popupDraws:0,backgroundDraws:0};
export function countDraw(kind){if(enabled)stats[kind]++}
export function recordFrame(time){
 if(!enabled||document.hidden)return;
 const state=recordFrame.state??={last:time,intervals:[]};
 if(time>state.last)state.intervals.push(time-state.last);state.last=time;stats.frames++;
 if(state.intervals.length>=120){
  const values=state.intervals.splice(0).sort((a,b)=>a-b);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  document.documentElement.dataset.performance=JSON.stringify({...stats,fps:Math.round(10000/mean)/10,p95ms:Math.round(values[Math.floor(values.length*.95)]*10)/10});
 }
}

if(enabled)document.addEventListener('visibilitychange',()=>{recordFrame.state=undefined});
