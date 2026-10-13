// Standalone offline rules; names and conditions mirror patterns.json.
const PATTERNS=Object.freeze({
  unexpected_admin_escalation:'관리자 권한 변화·명령 실행과 비정상 접속/계정 사용의 결합',
  possible_privilege_change:'취소·실패·단발·비관리 그룹 변경은 알림만',
  normal_activity:'권한 가로채기 근거 없는 정상 활동',
});
export function decide(alert){
  const raw=alert?.rule!==undefined||alert?.data!==undefined;
  const d=String((raw?alert?.rule?.description:alert?.description)??'').slice(0,2000);
  const level=Number(raw?alert?.rule?.level:alert?.level);
  const group=raw&&typeof alert?.data?.group==='string'?alert.data.group.toLowerCase():'';
  const admin=/관리자|administrator/iu.test(d)||group==='administrators';
  const added=/추가됐|추가와|들어가|들어왔|관리자가\s*된|권한으로\s*바뀌|다시\s*관리자로/u.test(d);
  const command=/명령.*실행|권한\s*명령/u.test(d);
  const anomalous=/원격\s*주소|처음\s*(?:보는|봅)|방금|평범한\s*계정|계정\s*\d+개|다른\s*계정의\s*권한|시간\s*밖|업무처럼\s*보이지|1분\s*뒤|다시\s*관리자로/u.test(d);
  const unconfirmed=/취소|실패|관리자\s*그룹은\s*아닙|변경은\s*없|명령은\s*없|설명만|읽기만/u.test(d);
  let confidence=.1,name='normal_activity';
  if(admin&&(added||command)&&anomalous&&!unconfirmed){confidence=.96;name='unexpected_admin_escalation';}
  else if(level>=5&&/권한|관리자|그룹|계정\s*종류/u.test(d)){confidence=.6;name='possible_privilege_change';}
  return{action:confidence>=.85?'block':confidence>=.5?'alert':'record',confidence,reason:name+': '+PATTERNS[name]};
}
