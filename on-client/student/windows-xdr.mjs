import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {platform} from 'node:os';
const run=promisify(execFile);
// Fixed, read-only selectors. The native process emits ONLY event type/time and
// verified signal booleans; paths, event bodies and OS accounts never leave it.
const script=String.raw`
$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$coverage=@{};$rows=@();$start=(Get-Date).AddHours(-24)
foreach($kind in @('service','security')){
 try {
  $filter=if($kind -eq 'service'){@{LogName='System';Id=7045;StartTime=$start}}else{@{LogName='Security';Id=4732,4672;StartTime=$start}}
  $events=@(Get-WinEvent -FilterHashtable $filter -MaxEvents 201)
  if($events.Count -ge 201){throw 'LIMIT'};$coverage[$kind]='measured'
  foreach($e in $events){
   $temp=$false;$unsigned=$false
   if($kind -eq 'service'){
    [xml]$xml=$e.ToXml();$raw=[string](($xml.Event.EventData.Data|Where-Object Name -eq 'ImagePath').'#text')
    $temp=($raw -match '(?i)[\\/]temp[\\/]')
    $file=if($raw -match '^"([^"\r\n]+)"'){$matches[1]}elseif($raw -match '^([^\r\n]+?\.exe)(?:\s|$)'){$matches[1]}else{''}
    if($file -and (Test-Path -LiteralPath $file -PathType Leaf)){try{$unsigned=((Get-AuthenticodeSignature -LiteralPath $file).Status -eq 'NotSigned')}catch{}}
   }
   $rows+=@{kind=$kind;eventId=$e.Id;recordId=$e.RecordId;at=$e.TimeCreated.ToUniversalTime().ToString('o');temporary=$temp;unsigned=$unsigned}
  }
 }catch{if($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'){$coverage[$kind]='measured'}else{$coverage[$kind]='unavailable'}}
}
@{coverage=$coverage;events=$rows}|ConvertTo-Json -Depth 5 -Compress`;
export async function readWindowsXdr({execute=run,os=platform()}={}){
  const unavailable={coverage:{status:'unavailable',serviceEvents:'unavailable',securityEvents:'unavailable'},events:[]};
  if(os!=='win32')return unavailable;
  try{
    const {stdout}=await execute('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout:9000,maxBuffer:131072,windowsHide:true});
    const r=JSON.parse(stdout.replace(/^\uFEFF/,''));
    if(!['measured','unavailable'].includes(r.coverage?.service)||!['measured','unavailable'].includes(r.coverage?.security)||!Array.isArray(r.events)||r.events.length>400)throw Error();
    return {coverage:{status:r.coverage.service==='measured'&&r.coverage.security==='measured'?'measured':'partial',serviceEvents:r.coverage.service,securityEvents:r.coverage.security},events:r.events.map(e=>{
      if(!['service','security'].includes(e.kind)||![7045,4732,4672].includes(e.eventId)||!Number.isInteger(e.recordId)||!Number.isFinite(Date.parse(e.at))||typeof e.temporary!=='boolean'||typeof e.unsigned!=='boolean')throw Error();
      return {key:e.kind+':'+e.recordId+':'+e.at,kind:e.kind==='service'?'persistence':'privilege',level:6,
        description:e.kind==='service'?'서비스 installed'+(e.temporary?' · 임시 폴더 실행':'')+(e.unsigned?' · unsigned':' · 서명 부재는 확인하지 못함'):
          e.eventId===4732?'관리자 여부 미확인 그룹의 계정 구성 변경 · 원격/비정상 사용 근거는 확인하지 못함':'특수 권한 할당 기록 · 관리자 권한 가로채기 여부는 확인하지 못함'};
    })};
  }catch{return unavailable;}
}
