// Student-owned, read-only PC observations. No account, host name, address or file contents.
import {cpus, freemem, totalmem, homedir, platform} from 'node:os';
import {statfs} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const unavailable = (unit, source) => ({status:'unavailable',value:null,unit,source,code:'PC_READ_UNAVAILABLE',message:'일반 권한으로 이 값을 읽지 못했습니다. 권한을 높이지 않고 확인 불가로 남깁니다.',observedAt:new Date().toISOString()});
const measured = (value,unit,source) => {
  if (!Number.isFinite(value)||value<0) throw Error('INVALID_MEASUREMENT');
  return {status:'measured',value,unit,source,observedAt:new Date().toISOString()};
};
async function observe(unit,source,operation){try{return measured(await operation(),unit,source);}catch{return unavailable(unit,source);}}
function cpuTimes(){
  const rows=cpus();if(!rows.length)throw Error('CPU_UNAVAILABLE');
  return rows.reduce((sum,row)=>({idle:sum.idle+row.times.idle,total:sum.total+Object.values(row.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
}
export async function readPcObservation({diskProbe=statfs}={}){
  const sampleStartedAt=new Date().toISOString();
  const cpu=observe('%','node:os.cpus · 전체 논리 CPU의 250ms 구간 평균',async()=>{
    const a=cpuTimes();await delay(250);const b=cpuTimes(),total=b.total-a.total,idle=b.idle-a.idle;
    if(total<=0||idle<0||idle>total)throw Error('CPU_UNAVAILABLE');return 100*(total-idle)/total;
  });
  const memory=observe('GiB','node:os.totalmem - freemem · OS 전체 메모리에서 여유 메모리를 뺀 값',async()=>{
    const total=totalmem(),free=freemem();if(total<=0||free<0||free>total)throw Error('MEMORY_UNAVAILABLE');return (total-free)/2**30;
  });
  const disk=observe('GiB','node:fs.statfs · 사용자 홈이 있는 파일시스템의 일반 사용자 가용 공간',async()=>{
    const fs=await diskProbe(homedir(),{bigint:true});return Number(fs.bavail*fs.bsize)/2**30;
  });
  const values=await Promise.all([cpu,memory,disk]);
  return {schema:'keshev.student.pc.v1',mode:'measured',platform:platform(),sampleStartedAt,observedAt:new Date().toISOString(),metrics:{cpu:values[0],memory:values[1],disk:values[2]},sdp:'not_checked',readOnly:true};
}
